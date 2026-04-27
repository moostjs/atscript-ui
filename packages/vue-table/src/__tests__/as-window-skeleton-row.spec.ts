import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AsWindowSkeletonRow from "../components/internal/as-window-skeleton-row.vue";
import { mockColumn } from "./helpers";

describe("<AsWindowSkeletonRow>", () => {
  it("renders one <tr> with one <td> per column at the given height", () => {
    const cols = [mockColumn("a"), mockColumn("b"), mockColumn("c")];
    const wrapper = mount({
      components: { AsWindowSkeletonRow },
      template: `<table><tbody><AsWindowSkeletonRow :columns="cols" :row-height="32" /></tbody></table>`,
      data: () => ({ cols }),
    });
    const tr = wrapper.find("tr.as-window-skeleton-row");
    expect(tr.exists()).toBe(true);
    expect(tr.attributes("style")).toContain("height: 32px");
    expect(wrapper.findAll("td.as-window-skeleton-cell")).toHaveLength(3);
  });

  it("adds a leading select cell when hasSelect is true", () => {
    const cols = [mockColumn("a")];
    const wrapper = mount({
      components: { AsWindowSkeletonRow },
      template: `<table><tbody><AsWindowSkeletonRow :columns="cols" :row-height="32" :has-select="true" /></tbody></table>`,
      data: () => ({ cols }),
    });
    expect(wrapper.findAll("td.as-window-skeleton-cell")).toHaveLength(2);
  });

  it("rowHeight prop drives the inline style", () => {
    const wrapper = mount({
      components: { AsWindowSkeletonRow },
      template: `<table><tbody><AsWindowSkeletonRow :columns="[]" :row-height="48" /></tbody></table>`,
    });
    expect(wrapper.find("tr.as-window-skeleton-row").attributes("style")).toContain("height: 48px");
  });
});
