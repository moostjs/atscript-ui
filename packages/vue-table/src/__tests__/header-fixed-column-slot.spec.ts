// @vitest-environment happy-dom
//
// Regression — `<AsTableHeader>` gated the whole `header-<path>` slot on
// `!col.fixed`, so an explicitly supplied header for a fixed (synthesised)
// column such as `__actions` was silently dropped. Only the DEFAULT header
// cell should be suppressed for a fixed column; reorder/resize stay off.
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { mount } from "@vue/test-utils";
import AsTableBase from "../components/internal/as-table-base.vue";
import { ROW_ACTIONS_PATH } from "../types";
import { mockColumn, thByPath } from "./helpers";

const fixedCol = mockColumn(ROW_ACTIONS_PATH, {
  label: "",
  fixed: true,
  sortable: false,
  filterable: false,
});
const cols = [fixedCol, mockColumn("name")];
const rows = [{ name: "Ann" }];

function mountHeader(slots?: Record<string, () => unknown>) {
  return mount(AsTableBase as unknown as Parameters<typeof mount>[0], {
    props: { columns: cols, rows, sorters: [], stretch: false },
    slots,
  });
}

describe("<AsTableHeader> fixed columns", () => {
  it("renders an explicitly supplied header slot for a fixed column", () => {
    const wrapper = mountHeader({
      [`header-${ROW_ACTIONS_PATH}`]: () => h("span", { class: "custom-actions-header" }, "Ops"),
    });
    const th = thByPath(wrapper.element, ROW_ACTIONS_PATH);
    expect(th.querySelector(".custom-actions-header")).not.toBeNull();
    expect(th.textContent).toContain("Ops");
  });

  it("keeps the default header of a fixed column blank", () => {
    const wrapper = mountHeader();
    const th = thByPath(wrapper.element, ROW_ACTIONS_PATH);
    expect(th.textContent?.trim()).toBe("");
    expect(th.querySelector(".as-th-btn")).toBeNull();
    // Data columns are unaffected — they still get the default header cell.
    expect(thByPath(wrapper.element, "name").querySelector(".as-th-btn")).not.toBeNull();
  });

  it("leaves a slotted fixed column non-draggable and non-resizable", () => {
    const wrapper = mountHeader({
      [`header-${ROW_ACTIONS_PATH}`]: () => h("span", { class: "custom-actions-header" }, "Ops"),
    });
    const th = thByPath(wrapper.element, ROW_ACTIONS_PATH);
    expect(th.getAttribute("draggable")).toBeNull();
    expect(th.querySelector(".as-th-resize-handle")).toBeNull();
    expect(thByPath(wrapper.element, "name").getAttribute("draggable")).toBe("true");
  });
});
