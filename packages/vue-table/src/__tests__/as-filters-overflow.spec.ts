// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { mount } from "@vue/test-utils";
import AsFilters from "../components/as-filters.vue";
import { mockColumn, mountWithTableContext } from "./helpers";

const PATHS = ["name", "status", "owner", "region"];

function setup(props: Record<string, unknown> = {}) {
  return mountWithTableContext(AsFilters, {
    columns: PATHS.map((p) => mockColumn(p)),
    props: { filterFields: PATHS, ...props },
  });
}

/**
 * Column paths of the filter fields rendered inline. The overflow popover is
 * portaled to `document.body`, so anything inside the wrapper is inline.
 */
function inlinePaths(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll(".as-filter-field")
    .map((f) => f.attributes("data-column-path") ?? f.text());
}

describe("<AsFilters> — overflow", () => {
  it("renders every field inline and no trigger when maxVisible is omitted", () => {
    const { wrapper } = setup();
    expect(inlinePaths(wrapper)).toHaveLength(PATHS.length);
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(false);
    // Multi-root fragment: no wrapper element of its own, so the fields are
    // direct children of whatever the host laid out.
    expect(wrapper.find(".as-filters").exists()).toBe(false);
  });

  it("with maxVisible=2 of 4 fields renders 2 inline plus the overflow trigger", () => {
    const { wrapper } = setup({ maxVisible: 2 });
    // 2 fields + the popover root (trigger).
    const trigger = wrapper.find(".as-filters-overflow-trigger");
    expect(trigger.exists()).toBe(true);
    expect(trigger.element.tagName).toBe("BUTTON");
    expect(trigger.attributes("aria-label")).toBe("More filters");
    expect(inlinePaths(wrapper)).toHaveLength(2);
  });

  it("badges only the ACTIVE overflow filters", async () => {
    const { wrapper, state } = setup({ maxVisible: 2 });
    // Nothing filtered yet.
    expect(wrapper.find(".as-filters-overflow-badge").exists()).toBe(false);

    // `name` is inline (index 0) → must NOT count; `owner` is overflowed.
    state.setFieldFilter("name", [{ op: "eq", value: "x" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").exists()).toBe(false);

    state.setFieldFilter("owner", [{ op: "eq", value: "y" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").text()).toBe("1");

    state.setFieldFilter("region", [{ op: "eq", value: "z" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").text()).toBe("2");
  });

  it("the popover renders the remaining fields", async () => {
    const { wrapper } = setup({ maxVisible: 2 });
    expect(document.body.querySelector(".as-filters-overflow")).toBeNull();

    await wrapper.find(".as-filters-overflow-trigger").trigger("click");

    const panel = document.body.querySelector(".as-filters-overflow");
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll(".as-filter-field")).toHaveLength(PATHS.length - 2);
  });

  it("overflow='none' drops the extra fields without a trigger", () => {
    const { wrapper } = setup({ maxVisible: 2, overflow: "none" });
    expect(inlinePaths(wrapper)).toHaveLength(2);
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(false);
  });
});
