// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount } from "@vue/test-utils";
import { flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import AsFilterField from "../components/defaults/as-filter-field.vue";
import AsFilterConditions from "../components/internal/as-filter-conditions.vue";
import AsFilterInput from "../components/defaults/as-filter-input.vue";
import { mockColumn, mountTableState, mountWithTableContext } from "./helpers";
import { defineComponent, h } from "vue";
import type { FilterCondition } from "@atscript/ui-table";

enableAutoUnmount(afterEach);

const createdAt = mockColumn("createdAt", {
  type: "datetime",
  valueKind: "timestamp",
  nullable: false,
});
const shippedAt = mockColumn("shippedAt", {
  type: "datetime",
  valueKind: "timestamp",
  nullable: true,
});
const paid = mockColumn("paid", { type: "boolean", valueKind: "boolean" });
const columns = [createdAt, shippedAt, paid, mockColumn("name")];

const NOW = Date.UTC(2026, 9, 5, 12);
const BERLIN_OCT5 = Date.UTC(2026, 9, 4, 22);
const BERLIN_OCT6 = Date.UTC(2026, 9, 5, 22);

describe("buildQuery encodes temporal filters in the table's zone", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("a day and a relative range become exact epoch bounds", () => {
    const { state } = mountTableState({ columns, timeZone: "Europe/Berlin" });
    state.setFieldFilter("createdAt", [{ type: "eq", value: ["2026-10-05"] }]);
    expect(state.buildQuery().filter).toEqual({
      createdAt: { $gte: BERLIN_OCT5, $lt: BERLIN_OCT6 },
    });

    state.setFieldFilter("createdAt", [{ type: "bw", value: ["today-6", "today"] }]);
    expect(state.buildQuery().filter).toEqual({
      createdAt: { $gte: Date.UTC(2026, 8, 28, 22), $lt: BERLIN_OCT6 },
    });
  });

  it("'today' follows the clock at each build and the zone", async () => {
    const zone = ref<string | undefined>("Europe/Berlin");
    const { state } = mountTableState({ columns, timeZone: zone });
    state.setFieldFilter("createdAt", [{ type: "eq", value: ["today"] }]);
    expect(state.buildQuery().filter).toEqual({
      createdAt: { $gte: BERLIN_OCT5, $lt: BERLIN_OCT6 },
    });
    expect(state.timeZone.value).toBe("Europe/Berlin");

    zone.value = "Pacific/Auckland";
    await nextTick();
    expect(state.buildQuery().filter).toEqual({
      // Already Oct 6 in Auckland (UTC+13).
      createdAt: { $gte: Date.UTC(2026, 9, 5, 11), $lt: Date.UTC(2026, 9, 6, 11) },
    });

    vi.setSystemTime(NOW + 24 * 3_600_000);
    expect(state.buildQuery().filter).toEqual({
      createdAt: { $gte: Date.UTC(2026, 9, 6, 11), $lt: Date.UTC(2026, 9, 7, 11) },
    });
  });

  it("boolean text from a link becomes a boolean; other columns are untouched", () => {
    const { state } = mountTableState({ columns, timeZone: "Europe/Berlin" });
    state.setFieldFilter("paid", [{ type: "eq", value: ["true"] }]);
    state.setFieldFilter("name", [{ type: "eq", value: ["2026-10-05"] }]);
    expect(state.buildQuery().filter).toEqual({
      $and: [{ paid: true }, { name: "2026-10-05" }],
    });
  });
});

describe("a time-zone change re-queries only when a date filter is set", () => {
  it("re-queries with a date filter, stays quiet without one", async () => {
    const zone = ref<string | undefined>("Europe/Berlin");
    const { state, pagesFn } = mountTableState({
      columns,
      queryOnMount: true,
      timeZone: zone,
    });
    await flushPromises();
    pagesFn.mockClear();

    zone.value = "Pacific/Auckland";
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();

    state.setFieldFilter("name", [{ type: "eq", value: ["x"] }]);
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();
    pagesFn.mockClear();
    zone.value = "America/New_York";
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();

    state.setFieldFilter("createdAt", [{ type: "eq", value: ["today"] }]);
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();
    pagesFn.mockClear();
    zone.value = "Europe/Berlin";
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });
});

// ── Components ───────────────────────────────────────────────

function mountInput(
  column: ReturnType<typeof mockColumn>,
  condition: FilterCondition,
  filterType: string,
) {
  const emitted: FilterCondition[] = [];
  const state = mountWithTableContext(
    defineComponent({
      setup() {
        return () =>
          h(AsFilterInput, {
            column,
            condition,
            filterType: filterType as never,
            "onUpdate:condition": (c: FilterCondition) => emitted.push(c),
          });
      },
    }),
    { columns: [column], timeZone: "Europe/Berlin" },
  );
  return { ...state, emitted };
}

describe("<AsFilterInput>", () => {
  it("clearing a number input leaves it unfilled, never 0", async () => {
    const n = mockColumn("total", { type: "number", valueKind: "number" });
    const { wrapper, emitted } = mountInput(n, { type: "eq", value: [5] }, "number");
    await wrapper.find("input").setValue("");
    expect(emitted.at(-1)!.value).toEqual([""]);
    await wrapper.find("input").setValue("7");
    expect(emitted.at(-1)!.value).toEqual([7]);
  });

  it("an integer column rejects fractions; a decimal stays a string", async () => {
    const int = mockColumn("qty", { type: "number", valueKind: "integer" });
    const a = mountInput(int, { type: "eq", value: [] }, "number");
    expect(a.wrapper.find("input").attributes("step")).toBe("1");
    await a.wrapper.find("input").setValue("2.5");
    expect(a.emitted.at(-1)!.value).toEqual([""]);

    const dec = mockColumn("price", { type: "number", valueKind: "decimal" });
    const b = mountInput(dec, { type: "eq", value: [] }, "number");
    await b.wrapper.find("input").setValue("12.340");
    expect(b.emitted.at(-1)!.value).toEqual(["12.340"]);
    await b.wrapper.find("input").setValue("1234567890.1234567");
    expect(b.emitted.at(-1)!.value).toEqual(["1234567890.1234567"]);
  });

  it("a date column renders a date input and emits the day", async () => {
    const d = mockColumn("day", { type: "text", valueKind: "date" });
    const { wrapper, emitted } = mountInput(d, { type: "eq", value: [] }, "date");
    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("date");
    expect(wrapper.find(".as-filter-input-time-toggle").exists()).toBe(false);
    await input.setValue("2026-10-05");
    expect(emitted.at(-1)!.value).toEqual(["2026-10-05"]);
  });

  it("a date-time column toggles to a time input and back, converting the value", async () => {
    const { wrapper, emitted } = mountInput(
      createdAt,
      { type: "gte", value: ["2026-10-05"] },
      "datetime",
    );
    expect(wrapper.find("input").attributes("type")).toBe("date");
    const toggle = wrapper.find(".as-filter-input-time-toggle");
    expect(toggle.attributes("aria-label")).toBe("Pick a time");
    await toggle.trigger("click");
    expect(wrapper.find("input").attributes("type")).toBe("datetime-local");
    expect(emitted.at(-1)!.value).toEqual(["2026-10-05T00:00"]);
    await wrapper.find("input").setValue("2026-10-05T14:30");
    expect(emitted.at(-1)!.value).toEqual(["2026-10-05T14:30"]);
    await toggle.trigger("click");
    expect(wrapper.find("input").attributes("type")).toBe("date");
  });

  it("precision follows the value's shape (a minute starts with the time on)", () => {
    const { wrapper } = mountInput(
      createdAt,
      { type: "gte", value: ["2026-10-05T14:30"] },
      "datetime",
    );
    expect(wrapper.find("input").attributes("type")).toBe("datetime-local");
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("2026-10-05T14:30");
  });

  it("a relative token shows as a pill; clicking it fills the input with its day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      const { wrapper, emitted } = mountInput(
        createdAt,
        { type: "eq", value: ["today-1"] },
        "datetime",
      );
      expect(wrapper.find("input").exists()).toBe(false);
      const pill = wrapper.find(".as-filter-input-token");
      expect(pill.text()).toContain("yesterday");
      await wrapper.find(".as-filter-input-token-label").trigger("click");
      expect(emitted.at(-1)!.value).toEqual(["2026-10-04"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an epoch number shows as a pill; × empties it", async () => {
    const { wrapper, emitted } = mountInput(
      createdAt,
      { type: "gte", value: [Date.UTC(2026, 9, 5, 12, 30)] },
      "datetime",
    );
    expect(wrapper.find(".as-filter-input-token").text()).toContain("Oct");
    await wrapper.find(".as-filter-input-token-remove").trigger("click");
    expect(emitted.at(-1)!.value).toEqual([""]);
  });

  it("between shows a pill and an input side by side", () => {
    const { wrapper } = mountInput(
      createdAt,
      { type: "bw", value: ["today-6", "2026-10-05"] },
      "datetime",
    );
    expect(wrapper.findAll(".as-filter-input-token")).toHaveLength(1);
    expect(wrapper.findAll("input")).toHaveLength(1);
  });
});

describe("<AsFilterConditions> on a date-time column", () => {
  function mountConditions(column = createdAt) {
    const model = ref<FilterCondition[]>([{ type: "eq", value: [] }]);
    const { wrapper } = mountWithTableContext(
      defineComponent({
        setup() {
          return () =>
            h(AsFilterConditions, {
              column,
              modelValue: model.value,
              "onUpdate:modelValue": (v: FilterCondition[]) => (model.value = v),
            });
        },
      }),
      { columns: [column] },
    );
    return { wrapper, model };
  }

  it("words the operators for dates", () => {
    const { wrapper } = mountConditions();
    const options = wrapper.findAll(".as-filter-condition-select option").map((o) => o.text());
    expect(options).toEqual([
      "on",
      "not on",
      "after",
      "on or after",
      "before",
      "on or before",
      "between",
    ]);
  });

  it("offers empty / not empty only when nullable", () => {
    const nullable = mountConditions(shippedAt).wrapper.findAll(
      ".as-filter-condition-select option",
    );
    expect(nullable.map((o) => o.text())).toContain("is empty");
  });

  it("shortcuts write relative conditions", async () => {
    const { wrapper, model } = mountConditions();
    const buttons = wrapper.findAll(".as-filter-shortcut-btn");
    expect(buttons.map((b) => b.text())).toContain("Last 7 days");
    await buttons.find((b) => b.text() === "Last 7 days")!.trigger("click");
    expect(model.value).toEqual([{ type: "bw", value: ["today-6", "today"] }]);
    await buttons.find((b) => b.text() === "Last month")!.trigger("click");
    expect(model.value).toEqual([{ type: "eq", value: ["month-1"] }]);
  });
});

describe("<AsFilterField> chips on a date-time column", () => {
  it("word the conditions: shortcut label, 'on <date>', datetime", async () => {
    const { wrapper, state } = mountWithTableContext(AsFilterField, {
      columns,
      timeZone: "Europe/Berlin",
      props: { column: createdAt },
    });
    state.setFieldFilter("createdAt", [
      { type: "bw", value: ["today-6", "today"] },
      { type: "eq", value: ["2026-10-05"] },
      { type: "gt", value: ["2026-10-05T14:30"] },
    ]);
    await nextTick();
    const chips = wrapper
      .findAll(".as-filter-field-chip")
      .map((c) => c.text().replace(/\s*×?\s*$/, ""));
    expect(chips[0]).toBe("Last 7 days");
    expect(chips[1]).toMatch(/^on .*2026/);
    expect(chips[2]).toMatch(/^after .*2026.*14:30/);
  });

  it("the plain input hints the date format and Enter applies a typed range", async () => {
    const { wrapper, state } = mountWithTableContext(AsFilterField, {
      columns,
      props: { column: createdAt },
    });
    const input = wrapper.find("input.as-filter-field-search");
    expect(input.attributes("placeholder")).toBe("YYYY-MM-DD");
    await input.setValue(">=2026-01-01");
    await input.trigger("keydown.enter");
    expect(state.filters.value.createdAt).toEqual([{ type: "gte", value: ["2026-01-01"] }]);
    await input.setValue("abc");
    await input.trigger("keydown.enter");
    expect(state.filters.value.createdAt).toHaveLength(1);
  });
});
