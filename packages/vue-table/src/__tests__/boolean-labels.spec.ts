import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { createTableDef, type ColumnDef, type MetaResponse } from "@atscript/ui";
import {
  columnFilterConditions,
  formatColumnCondition,
  parseColumnFilterInput,
  resolveExportValue,
} from "@atscript/ui-table";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import AsTableCellValue from "../components/defaults/as-table-cell-value.vue";
import AsFilterInput from "../components/defaults/as-filter-input.vue";
import AsFilterValueHelp from "../components/internal/as-filter-value-help.vue";
import { hasValuePicker } from "../composables/use-value-pickers";
import { formatCellValue } from "../utils/format-cell";
import AsFilterField from "../components/defaults/as-filter-field.vue";
import { mountWithTableContext } from "./helpers";

/**
 * A boolean column reads like a two-value enum: `true` / `false` labelled by
 * `@ui.literalLabel`, `Yes` / `No` by default — in the cell, the filter chips,
 * export, the picker, the condition input and typed filter text.
 */
function booleanColumns(): (path: string) => ColumnDef {
  const bool = () => defineAnnotatedType().designType("boolean");
  const type = defineAnnotatedType("object")
    .prop(
      "active",
      bool()
        .annotate("ui.literalLabel" as never, { value: "true", label: "Active" } as never, true)
        .annotate("ui.literalLabel" as never, { value: "false", label: "Inactive" } as never, true)
        .$type,
    )
    .prop("plain", bool().$type)
    .prop(
      "maybe",
      defineAnnotatedType("union")
        .item(bool().$type)
        .item(defineAnnotatedType().designType("null").$type).$type,
    ).$type;
  const names = ["active", "plain", "maybe"];
  const meta: MetaResponse = {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: [],
    preferredId: [],
    crud: {},
    actions: [],
    relations: [],
    fields: Object.fromEntries(names.map((k) => [k, { sortable: true, filterable: true }])),
    type: serializeAnnotatedType(type as never),
  };
  const def = createTableDef(meta);
  return (path) => def.columns.find((c) => c.path === path)!;
}

function cellText(row: Record<string, unknown>, column: ColumnDef): string {
  return mount(AsTableCellValue as never, { props: { row, column } } as never)
    .text()
    .trim();
}

describe("boolean columns — labels everywhere", () => {
  it("the default cell shows the label (Yes / No when unlabelled), not a check mark", () => {
    const col = booleanColumns();
    expect(cellText({ active: true }, col("active"))).toBe("Active");
    expect(cellText({ active: false }, col("active"))).toBe("Inactive");
    expect(cellText({ plain: true }, col("plain"))).toBe("Yes");
    expect(cellText({ plain: false }, col("plain"))).toBe("No");
    expect(cellText({ maybe: null }, col("maybe"))).toBe("");
  });

  it("a boolean without options (hand-built column, union cell) formats as Yes / No", () => {
    expect(formatCellValue(true, "boolean")).toBe("Yes");
    expect(formatCellValue(false, "boolean")).toBe("No");
    const bare: ColumnDef = { ...booleanColumns()("plain"), options: undefined };
    expect(cellText({ plain: false }, bare)).toBe("No");
  });

  it("filter chips read the label", () => {
    const col = booleanColumns();
    expect(formatColumnCondition(col("active"), { type: "eq", value: [true] })).toBe("Active");
    expect(formatColumnCondition(col("plain"), { type: "ne", value: [false] })).toBe("!=No");
  });

  it("export carries the label", () => {
    const col = booleanColumns();
    expect(resolveExportValue(true, col("active"))).toBe("Active");
    expect(resolveExportValue(false, col("plain"))).toBe("No");
    expect(resolveExportValue(null, col("plain"))).toBeNull();
  });

  it("typed filter text takes the label: `Active` filters true", () => {
    const col = booleanColumns();
    expect(parseColumnFilterInput("Active", col("active"))).toEqual({ type: "eq", value: [true] });
    expect(parseColumnFilterInput("no", col("plain"))).toEqual({ type: "eq", value: [false] });
  });

  it("the column offers the value picker; `boolean | null` also offers is empty", () => {
    const col = booleanColumns();
    expect(hasValuePicker(undefined, col("active"))).toBe(true);
    expect(columnFilterConditions(col("active"))).toEqual(["eq", "ne"]);
    expect(columnFilterConditions(col("maybe"))).toEqual(["eq", "ne", "null", "notNull"]);
  });

  it("the condition input's boolean select is worded by the column", () => {
    const col = booleanColumns();
    const optionsOf = (column: ColumnDef) =>
      mount(
        AsFilterInput as never,
        {
          props: { column, condition: { type: "eq", value: [] }, filterType: "boolean" },
        } as never,
      )
        .findAll("option:not([disabled])")
        .map((o) => [o.attributes("value"), o.text()]);
    expect(optionsOf(col("active"))).toEqual([
      ["true", "Active"],
      ["false", "Inactive"],
    ]);
    expect(optionsOf(col("plain"))).toEqual([
      ["true", "Yes"],
      ["false", "No"],
    ]);
  });
});

describe("AsFilterValueHelp — enum rows carry the typed value", () => {
  async function dialogRows(column: ColumnDef, model: unknown[]) {
    const Wrapper = defineComponent({
      setup() {
        const conditions = ref(model.map((v) => ({ type: "eq", value: [v] })));
        return () => h(AsFilterValueHelp as never, { column, modelValue: conditions.value });
      },
    });
    const wrapper = mount(Wrapper, { attachTo: document.body });
    const vh = wrapper.findComponent(AsFilterValueHelp as any);
    await flushPromises();
    const inner = (vh.vm.$ as any).setupState.innerState;
    inner.viewportRowCount.value = 10;
    await flushPromises();
    await nextTick();
    await flushPromises();
    const rows = [...inner.windowCache.value.values()] as Record<string, unknown>[];
    const selected = [...inner.selectedRows.value];
    wrapper.unmount();
    return { rows: rows.map((r) => [r.__value, r.__label]), selected };
  }

  it("a boolean column's rows are true / false with labels; a picked `true` shows selected", async () => {
    const col = booleanColumns();
    const { rows, selected } = await dialogRows(col("active"), [true]);
    expect(rows).toEqual([
      [true, "Active"],
      [false, "Inactive"],
    ]);
    expect(selected).toEqual([true]);
  });

  it("a numeric literal union's rows carry numbers, as the inline picker emits them", async () => {
    const column: ColumnDef = {
      path: "level",
      label: "Level",
      type: "enum",
      valueKind: "number",
      sortable: true,
      filterable: true,
      nullable: false,
      order: 0,
      options: [
        { key: "1", label: "One", value: 1 },
        { key: "2", label: "Two", value: 2 },
      ],
    };
    const { rows } = await dialogRows(column, [2]);
    expect(rows).toEqual([
      [1, "One"],
      [2, "Two"],
    ]);
  });

  it("a filter saved with the string form (`'true'`, `'2'`) shows selected", async () => {
    const col = booleanColumns();
    expect((await dialogRows(col("active"), ["true"])).selected).toEqual([true]);
  });
});

describe("<AsFilterField> on a boolean column — typed text beside the picker", () => {
  async function typeAndEnter(column: ColumnDef, text: string) {
    const { wrapper, state } = mountWithTableContext(AsFilterField, {
      columns: [column],
      props: { column },
    });
    const input = wrapper.find(".as-filter-field-search");
    expect(input.attributes("role")).toBe("combobox"); // the picker, not a plain input
    await input.setValue(text);
    await input.trigger("keydown", { key: "Enter" });
    await nextTick();
    const conditions = state.filters.value[column.path];
    wrapper.unmount();
    return conditions;
  }

  it("an operator the list does not show is a condition: `!=Active`, `<empty>`", async () => {
    const col = booleanColumns();
    expect(await typeAndEnter(col("active"), "!=Active")).toEqual([{ type: "ne", value: [true] }]);
    expect(await typeAndEnter(col("maybe"), "<empty>")).toEqual([{ type: "null", value: [] }]);
    expect(await typeAndEnter(col("maybe"), "!<empty>")).toEqual([{ type: "notNull", value: [] }]);
  });

  it("a raw value (`true`) still filters, as before the picker", async () => {
    const col = booleanColumns();
    expect(await typeAndEnter(col("plain"), "true")).toEqual([{ type: "eq", value: [true] }]);
  });
});
