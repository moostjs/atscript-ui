import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@atscript/ui";
import AsTableStatus from "../components/internal/as-table-status.vue";
import AsFilterConditions from "../components/internal/as-filter-conditions.vue";
import AsFilterInput from "../components/defaults/as-filter-input.vue";
import AsSortersConfig from "../components/internal/as-sorters-config.vue";
import AsOrderableList from "../components/internal/as-orderable-list.vue";
import AsSelectCell from "../components/internal/as-select-cell.vue";
import AsFilters from "../components/as-filters.vue";
import { formatCellValue } from "../utils/format-cell";
import { mockColumn, mountWithTableContext } from "./helpers";

/**
 * Untranslated (no provider, no served texts) the built-in texts render
 * exactly as they always did: the snapshots were recorded before the texts
 * moved to `AS_UI_MESSAGES`. Whitespace at the very start / end of an
 * element's content is not compared (it does not render, and a template
 * interpolation on its own line has none).
 */
const edges = (html: string) =>
  html.replace(/(<[a-zA-Z][^>]*>)\s+/g, "$1").replace(/\s+(<\/)/g, "$1");
const created = mockColumn("created", { label: "Created", type: "date", valueKind: "isoDate" });
const flag = mockColumn("flag", {
  label: "Flag",
  type: "boolean",
  valueKind: "boolean",
  options: [
    { key: "true", label: "Yes", value: true },
    { key: "false", label: "No", value: false },
  ],
});
const name = mockColumn("name", { label: "Name" });
const noop = () => {};
const at = mockColumn("at", { label: "At", type: "datetime", valueKind: "timestamp" });

function html(component: unknown, props: Record<string, unknown>, columns: ColumnDef[] = []) {
  return edges(mountWithTableContext(component, { columns, props }).wrapper.html());
}

describe("built-in English texts are unchanged", () => {
  it("table status: error, empty, no match", () => {
    const base = { querying: false, columns: [name], hasActiveFilters: false };
    for (const props of [
      { ...base, queryError: new Error("boom"), isEmpty: false, onRetry: noop },
      { ...base, queryError: null, isEmpty: true },
      { ...base, queryError: null, isEmpty: true, searchTerm: "zz", onClearFilters: noop },
      { ...base, queryError: null, isEmpty: true, hasActiveFilters: true, onClearFilters: noop },
    ]) {
      expect(html(AsTableStatus, props, [name])).toMatchSnapshot();
    }
  });

  it("filter conditions and inputs", () => {
    for (const column of [created, name, flag, at]) {
      expect(
        html(
          AsFilterConditions,
          { column, modelValue: [{ type: "eq", value: [] }], "onUpdate:modelValue": () => {} },
          [column],
        ),
      ).toMatchSnapshot();
    }
    for (const [column, condition, filterType] of [
      [flag, { type: "eq", value: [] }, "boolean"],
      [name, { type: "eq", value: [] }, "text"],
      [created, { type: "bw", value: [] }, "date"],
      [at, { type: "eq", value: [] }, "datetime"],
    ] as const) {
      expect(html(AsFilterInput, { column, condition, filterType }, [column])).toMatchSnapshot();
    }
  });

  it("sorters, orderable list, select cell", () => {
    expect(
      html(
        AsSortersConfig,
        {
          columns: [name, created],
          forceSorters: [{ field: "name", direction: "asc" }],
          modelValue: [
            { field: "name", direction: "asc" },
            { field: "created", direction: "desc" },
          ],
        },
        [name, created],
      ),
    ).toMatchSnapshot();
    expect(
      html(AsOrderableList, {
        items: ["a", "b"],
        getLabel: (i: string) => i,
        getValue: (i: string) => i,
        modelValue: ["a"],
      }),
    ).toMatchSnapshot();
    const cell = { row: { id: 1 }, index: 0, selected: false, select: "multi", selectOn: "check" };
    for (const verdict of [{ ok: true }, { ok: false, reason: "locked" }, { ok: false }]) {
      expect(html(AsSelectCell, { ...cell, verdict })).toMatchSnapshot();
    }
  });

  it("filter bar chips: residual filter, temporal and boolean conditions", async () => {
    const { wrapper, state } = mountWithTableContext(AsFilters, {
      columns: [created, flag, name],
      props: { filterFields: ["created", "flag", "name"] },
    });
    state.setResidualFilters([
      { $or: [{ name: "a" }, { name: { $in: ["b", "c"] } }] },
      { name: { $exists: false } },
    ]);
    state.filters.value = {
      created: [
        { type: "bw", value: ["today-6", "today"] },
        { type: "lt", value: ["month-2"] },
      ],
      flag: [{ type: "eq", value: [true] }],
    };
    await wrapper.vm.$nextTick();
    expect(edges(wrapper.html())).toMatchSnapshot();
  });

  it("boolean cells", () => {
    expect([formatCellValue(true, "boolean"), formatCellValue(false, "boolean")]).toEqual([
      "Yes",
      "No",
    ]);
  });
});
