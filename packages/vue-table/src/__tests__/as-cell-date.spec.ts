import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { ColumnDef } from "@atscript/ui";
import AsCellDate from "../components/defaults/as-cell-date.vue";
import { provideCellLocale } from "../composables/use-cell-locale";

function makeColumn(type: string, overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    path: "ts",
    label: "Timestamp",
    type,
    sortable: false,
    filterable: false,
    nullable: false,
    visible: true,
    order: 0,
    ...overrides,
  };
}

function mountCell(
  row: Record<string, unknown>,
  column: ColumnDef,
  language = "en-US",
  timezone?: string,
) {
  const Host = defineComponent({
    setup() {
      provideCellLocale({ language, timezone });
    },
    render() {
      return h("table", [h("tbody", [h("tr", [h(AsCellDate, { row, column })])])]);
    },
  });
  return mount(Host);
}

describe("AsCellDate", () => {
  it("renders empty cell for null/undefined", () => {
    expect(mountCell({ ts: null }, makeColumn("date")).find("td").text()).toBe("");
    expect(mountCell({ ts: undefined }, makeColumn("date")).find("td").text()).toBe("");
  });

  it("formats epoch ms as date-only for cell-type 'date'", () => {
    const epoch = Date.UTC(2024, 0, 15, 12, 0, 0); // 2024-01-15
    const wrapper = mountCell({ ts: epoch }, makeColumn("date"), "en-US", "UTC");
    expect(wrapper.find("td").text()).toMatch(/Jan 0?15, 2024/);
  });

  it("includes hour:minute for cell-type 'datetime'", () => {
    const epoch = Date.UTC(2024, 0, 15, 14, 30, 0);
    const wrapper = mountCell({ ts: epoch }, makeColumn("datetime"), "en-US", "UTC");
    // "Jan 15, 2024, 02:30 PM" or similar — assert the time piece is present.
    expect(wrapper.find("td").text()).toMatch(/02:30/);
  });

  it("title attr always carries the absolute ISO", () => {
    // Pin a non-midnight time so timezone arithmetic doesn't shift the
    // ISO across days when the local TZ is non-UTC.
    const epoch = Date.UTC(2024, 5, 3, 12, 0, 0);
    const wrapper = mountCell({ ts: epoch }, makeColumn("datetime"), "en-US", "UTC");
    expect(wrapper.find("td").attributes("title")).toBe("2024-06-03T12:00:00.000Z");
  });

  it("accepts ISO string input", () => {
    const wrapper = mountCell({ ts: "2024-01-15T00:00:00Z" }, makeColumn("date"), "en-US", "UTC");
    expect(wrapper.find("td").text()).toMatch(/Jan 0?15, 2024/);
  });

  it("accepts Date instance input", () => {
    const d = new Date(Date.UTC(2024, 1, 1));
    const wrapper = mountCell({ ts: d }, makeColumn("date"), "en-US", "UTC");
    // Intl emits day with leading zero (`day: '2-digit'`).
    expect(wrapper.find("td").text()).toMatch(/Feb 0?1, 2024/);
  });

  it("falls back to empty for invalid timestamps", () => {
    expect(mountCell({ ts: "not a date" }, makeColumn("date")).find("td").text()).toBe("");
    expect(mountCell({ ts: NaN }, makeColumn("date")).find("td").text()).toBe("");
  });

  it("renders empty cell for the Unix epoch sentinel (timestamp 0)", () => {
    expect(mountCell({ ts: 0 }, makeColumn("datetime"), "en-US", "UTC").find("td").text()).toBe("");
    expect(mountCell({ ts: 0 }, makeColumn("date"), "en-US", "UTC").find("td").text()).toBe("");
    expect(
      mountCell({ ts: new Date(0) }, makeColumn("datetime"), "en-US", "UTC")
        .find("td")
        .text(),
    ).toBe("");
  });

  describe("relative cell-type", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Wall clock fixed at 2024-06-15T12:00:00Z so relative deltas are
      // deterministic across local timezones.
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("renders past time as 'X ago'", () => {
      const epoch = new Date("2024-06-15T09:00:00Z").getTime(); // 3h ago
      const wrapper = mountCell({ ts: epoch }, makeColumn("relative"), "en-US");
      expect(wrapper.find("td").text()).toMatch(/3 hours ago/);
    });

    it("renders future time as 'in X'", () => {
      const epoch = new Date("2024-06-15T14:00:00Z").getTime(); // +2h
      const wrapper = mountCell({ ts: epoch }, makeColumn("relative"), "en-US");
      expect(wrapper.find("td").text()).toMatch(/in 2 hours/);
    });

    it("uses days for >1 day deltas", () => {
      const epoch = new Date("2024-06-12T12:00:00Z").getTime(); // -3 days
      const wrapper = mountCell({ ts: epoch }, makeColumn("relative"), "en-US");
      expect(wrapper.find("td").text()).toMatch(/3 days ago/);
    });
  });
});
