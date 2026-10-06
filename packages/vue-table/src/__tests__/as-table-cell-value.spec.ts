import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AsTableCellValue from "../components/defaults/as-table-cell-value.vue";
import { mockColumn } from "./helpers";

function cellText(row: Record<string, unknown>, options?: { key: string; label: string }[]) {
  const column = mockColumn("status", { type: "enum", options });
  return mount(AsTableCellValue as never, { props: { row, column } } as never)
    .text()
    .trim();
}

describe("AsTableCellValue — union option labels (@ui.literalLabel)", () => {
  const options = [
    { key: "open", label: "Open" },
    { key: "in-progress", label: "In progress" },
  ];

  it("shows the label of the stored literal", () => {
    expect(cellText({ status: "in-progress" }, options)).toBe("In progress");
  });

  it("falls back to the raw value for an unlabelled / unknown literal", () => {
    expect(cellText({ status: "archived" }, options)).toBe("archived");
  });

  it("is the plain value when the column has no options", () => {
    expect(cellText({ status: "in-progress" })).toBe("in-progress");
  });
});
