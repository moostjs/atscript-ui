import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { ColumnDef } from "@atscript/ui";
import AsCellJson from "../components/defaults/as-cell-json.vue";

function makeColumn(): ColumnDef {
  return {
    path: "address",
    label: "Address",
    type: "object",
    sortable: false,
    filterable: false,
    visible: true,
    order: 0,
  };
}

function mountCell(row: Record<string, unknown>) {
  const Host = defineComponent({
    render() {
      return h("table", [h("tbody", [h("tr", [h(AsCellJson, { row, column: makeColumn() })])])]);
    },
  });
  return mount(Host, { attachTo: document.body });
}

describe("AsCellJson", () => {
  it("renders {} trigger for object value", () => {
    const wrapper = mountCell({ address: { street: "x", city: "y" } });
    const trigger = wrapper.find(".as-cell-json-trigger");
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toContain("{}");
  });

  it("renders empty cell for null/undefined", () => {
    expect(mountCell({ address: null }).find(".as-cell-json-trigger").exists()).toBe(false);
    expect(mountCell({ address: undefined }).find(".as-cell-json-trigger").exists()).toBe(false);
  });

  it("renders empty cell for non-object value", () => {
    expect(mountCell({ address: "not-an-object" }).find(".as-cell-json-trigger").exists()).toBe(
      false,
    );
  });

  it("opens popover with pretty JSON on click", async () => {
    const wrapper = mountCell({ address: { street: "Main", city: "Demo" } });
    await wrapper.find(".as-cell-json-trigger").trigger("click");
    const popup = document.body.querySelector(".as-cell-json-popup");
    expect(popup).not.toBeNull();
    const text = popup?.textContent ?? "";
    expect(text).toContain('"street": "Main"');
    expect(text).toContain('"city": "Demo"');
    wrapper.unmount();
  });

  it("popover body survives circular references via String() fallback", async () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const wrapper = mountCell({ address: obj });
    await wrapper.find(".as-cell-json-trigger").trigger("click");
    // Should not throw — the body either renders an empty <pre> or a String()
    // fallback. Just verify the popup mounted without an exception.
    expect(document.body.querySelector(".as-cell-json-popup")).not.toBeNull();
    wrapper.unmount();
  });
});
