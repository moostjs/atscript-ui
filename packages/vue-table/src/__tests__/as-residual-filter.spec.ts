// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import AsFilters from "../components/as-filters.vue";
import { mockColumn, mountWithTableContext } from "./helpers";

const PATHS = ["status", "total", "owner"];
const OR = {
  $or: [
    { status: "shipped", total: { $gt: 500 } },
    { status: "pending", total: { $lte: 50 } },
  ],
};

function setup(props: Record<string, unknown> = {}) {
  return mountWithTableContext(AsFilters, {
    columns: [
      mockColumn("status", { label: "Status" }),
      mockColumn("total", { label: "Total", type: "number" }),
      mockColumn("owner"),
    ],
    props: { filterFields: PATHS, ...props },
  });
}

describe("<AsFilters> — residual filter chips", () => {
  it("renders one chip per residual condition, worded with column labels", async () => {
    const { wrapper, state } = setup();
    expect(wrapper.find(".as-residual-filter").exists()).toBe(false);

    state.setResidualFilters([OR, { owner: { $exists: true } }]);
    await wrapper.vm.$nextTick();

    const chips = wrapper.findAll(".as-residual-filter");
    expect(chips).toHaveLength(2);
    const text = chips.map((c) => c.find(".as-residual-filter-text").text());
    expect(text).toContain(
      "(Status equals shipped and Total greater than 500) or (Status equals pending and Total less or equal 50)",
    );
    expect(text).toContain("owner: not empty");
    expect(chips[0].find(".as-residual-filter-label").text()).toBe("Custom filter");
  });

  it("the remove button drops exactly that condition", async () => {
    const { wrapper, state } = setup();
    state.setResidualFilters([OR, { owner: { $exists: true } }]);
    await wrapper.vm.$nextTick();

    const target = state.residualFilters.value[0];
    await wrapper.findAll(".as-residual-filter-remove")[0].trigger("click");
    expect(state.residualFilters.value).toHaveLength(1);
    expect(state.residualFilters.value).not.toContain(target);
    expect(wrapper.findAll(".as-residual-filter")).toHaveLength(1);
  });

  it("stays inline when every field overflows", async () => {
    const { wrapper, state } = setup({ maxVisible: 0 });
    state.setResidualFilters([OR]);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".as-filter-field")).toHaveLength(0);
    expect(wrapper.findAll(".as-residual-filter")).toHaveLength(1);
  });

  it(":residual=false leaves placement to the host", async () => {
    const { wrapper, state } = setup({ residual: false });
    state.setResidualFilters([OR]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-residual-filter").exists()).toBe(false);
  });
});
