import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { ColumnDef } from "@atscript/ui";
import AsCellArray from "../components/defaults/as-cell-array.vue";

function makeColumn(): ColumnDef {
  return {
    path: "items",
    label: "Items",
    type: "array",
    sortable: false,
    filterable: false,
    nullable: false,
    visible: true,
    order: 0,
  };
}

function mountCell(row: Record<string, unknown>) {
  const Host = defineComponent({
    render() {
      return h("table", [h("tbody", [h("tr", [h(AsCellArray, { row, column: makeColumn() })])])]);
    },
  });
  return mount(Host, { attachTo: document.body });
}

describe("AsCellArray", () => {
  it("renders chips for primitive string array", () => {
    const wrapper = mountCell({ items: ["new", "featured", "sale"] });
    const chips = wrapper.findAll(".as-cell-chip");
    expect(chips).toHaveLength(3);
    expect(chips[0]!.text()).toBe("new");
    expect(chips[1]!.text()).toBe("featured");
  });

  it("renders chips for primitive number array", () => {
    const wrapper = mountCell({ items: [1, 2, 3] });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(3);
  });

  it("renders chips for primitive boolean array", () => {
    const wrapper = mountCell({ items: [true, false] });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(2);
  });

  it("renders {} trigger for object-array", () => {
    const wrapper = mountCell({
      items: [
        { id: 1, name: "x" },
        { id: 2, name: "y" },
      ],
    });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(0);
    const trigger = wrapper.find(".as-cell-json-trigger");
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toContain("{}");
    expect(trigger.text()).toContain("[2]");
  });

  it("renders empty cell for empty array", () => {
    const wrapper = mountCell({ items: [] });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(0);
    expect(wrapper.find(".as-cell-json-trigger").exists()).toBe(false);
  });

  it("renders empty cell for non-array value", () => {
    const wrapper = mountCell({ items: null });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(0);
    expect(wrapper.find(".as-cell-json-trigger").exists()).toBe(false);
  });

  it("treats mixed primitive+object array as object-array (object-popover branch)", () => {
    const wrapper = mountCell({ items: ["a", { x: 1 }] });
    expect(wrapper.findAll(".as-cell-chip")).toHaveLength(0);
    expect(wrapper.find(".as-cell-json-trigger").exists()).toBe(true);
  });

  it("opens popover on trigger click", async () => {
    const wrapper = mountCell({ items: [{ id: 1 }, { id: 2 }] });
    await wrapper.find(".as-cell-json-trigger").trigger("click");
    // Reka portals into document.body — query the live DOM.
    const popup = document.body.querySelector(".as-cell-json-popup");
    expect(popup).not.toBeNull();
    expect(popup?.textContent).toContain('"id": 1');
    wrapper.unmount();
  });
});
