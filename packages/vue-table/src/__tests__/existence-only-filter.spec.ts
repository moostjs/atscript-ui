// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { useTableFilter } from "../composables/use-table-filter";
import AsFilterConditions from "../components/internal/as-filter-conditions.vue";
import { mockColumn, mountTableState } from "./helpers";

// A JSON-stored column: `/meta` says it is not value-filterable but accepts
// `$exists`, so the filter UI offers exactly "is empty" / "is not empty".
const json = mockColumn("payload", {
  type: "object",
  filterable: false,
  filterOps: ["$exists"],
  nullable: true,
});

describe("existence-only (filterOps: ['$exists']) columns", () => {
  it("useTableFilter offers only null / notNull and defaults to one of them", () => {
    const { state } = mountTableState({ columns: [json], queryOnMount: false });
    const filter = useTableFilter(json, state);
    expect(filter.availableConditions).toEqual(["null", "notNull"]);
    expect(filter.defaultCondition).toBe("null");
    expect(filter.conditions.value).toEqual([{ type: "null", value: [] }]);
  });

  it("the condition picker lists only the empty / not-empty pair", () => {
    const wrapper = mount(AsFilterConditions, {
      props: { column: json, modelValue: [{ type: "notNull", value: [] }] },
    });
    const options = wrapper.findAll("option").map((o) => o.attributes("value"));
    expect(options).toEqual(["null", "notNull"]);
  });

  it("a filter on it encodes to $exists", () => {
    const { state } = mountTableState({ columns: [json], queryOnMount: false });
    state.setFieldFilter("payload", [{ type: "notNull", value: [] }]);
    expect(state.buildQuery().filter).toEqual({ payload: { $exists: true } });
  });
});
