import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { ColumnDef } from "@atscript/ui";
import AsCellNumber from "../components/defaults/as-cell-number.vue";
import { provideCellLocale } from "../composables/use-cell-locale";

function makeColumn(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    path: "value",
    label: "Value",
    type: "number",
    sortable: false,
    filterable: false,
    nullable: false,
    order: 0,
    ...overrides,
  };
}

function mountCell(row: Record<string, unknown>, column: ColumnDef, locale = "en-US") {
  const Host = defineComponent({
    setup() {
      provideCellLocale({ language: locale });
    },
    render() {
      return h("table", [h("tbody", [h("tr", [h(AsCellNumber, { row, column })])])]);
    },
  });
  return mount(Host);
}

describe("AsCellNumber", () => {
  it("renders plain numbers without grouping", () => {
    const wrapper = mountCell({ value: 1234.5 }, makeColumn(), "en-US");
    expect(wrapper.find("td").text()).toBe("1234.5");
  });

  it("coerces decimal strings to numbers", () => {
    const wrapper = mountCell({ value: "19.99" }, makeColumn());
    expect(wrapper.find("td").text()).toBe("19.99");
  });

  it("formats with literal currency", () => {
    const col = makeColumn({ currencyCode: "USD" });
    const wrapper = mountCell({ value: "1234.5" }, col, "en-US");
    // Intl emits NBSP between symbol and digits in some locales — match
    // by digits + currency marker rather than exact whitespace.
    expect(wrapper.find("td").text()).toMatch(/\$1,234\.50/);
  });

  it("formats with per-row currency via .ref sibling", () => {
    const col = makeColumn({ currencyRefField: "currency" });
    const wrapper = mountCell({ value: "42", currency: "EUR" }, col, "en-US");
    expect(wrapper.find("td").text()).toMatch(/€42\.00/);
  });

  it("appends literal unit", () => {
    const col = makeColumn({ unitCode: "kg", precisionScale: 2 });
    const wrapper = mountCell({ value: "2.5" }, col, "en-US");
    expect(wrapper.find("td").text()).toBe("2.50 kg");
  });

  it("appends per-row unit via .ref", () => {
    const col = makeColumn({ unitRefField: "unit" });
    const wrapper = mountCell({ value: 100, unit: "rpm" }, col, "en-US");
    expect(wrapper.find("td").text()).toMatch(/100 rpm$/);
  });

  it("respects @db.column.precision scale", () => {
    const col = makeColumn({ precisionScale: 4 });
    const wrapper = mountCell({ value: "3.1" }, col, "en-US");
    expect(wrapper.find("td").text()).toBe("3.1000");
  });

  it("groups precision-scaled decimals without currency/unit", () => {
    const col = makeColumn({ precisionScale: 2 });
    const wrapper = mountCell({ value: 1234.5 }, col, "en-US");
    expect(wrapper.find("td").text()).toBe("1,234.50");
  });

  it("renders empty for null/undefined/empty-string", () => {
    expect(mountCell({ value: null }, makeColumn()).find("td").text()).toBe("");
    expect(mountCell({ value: undefined }, makeColumn()).find("td").text()).toBe("");
    expect(mountCell({ value: "" }, makeColumn()).find("td").text()).toBe("");
  });

  it("falls back to raw string for non-finite values", () => {
    const wrapper = mountCell({ value: "not-a-number" }, makeColumn());
    expect(wrapper.find("td").text()).toBe("not-a-number");
  });

  it("falls back to plain decimal when currency code is malformed", () => {
    const col = makeColumn({ currencyCode: "BOGUS_LONG_CODE" });
    const wrapper = mountCell({ value: "10" }, col, "en-US");
    // Don't assert the exact result — just that we got SOMETHING numeric
    // (no throw, no NaN literal).
    expect(wrapper.find("td").text()).not.toBe("");
    expect(wrapper.find("td").text()).not.toMatch(/NaN/);
  });

  it("applies as-cell-number + as-cell-decimal classes", () => {
    const wrapper = mountCell({ value: 1 }, makeColumn());
    const classes = wrapper.find("td").classes();
    expect(classes).toContain("as-cell-number");
    expect(classes).toContain("as-cell-decimal");
  });
});
