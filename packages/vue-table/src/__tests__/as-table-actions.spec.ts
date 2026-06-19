// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client, TDbActionInfo } from "@atscript/db-client";
import AsTableActions from "../components/as-table-actions.vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import type { ReactiveTableState, TVueTableActionInfo } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

const tableExport: TDbActionInfo = {
  name: "export",
  label: "Export",
  level: "table",
  processor: "custom",
  value: "export",
};
const rowsBulk: TDbActionInfo = {
  name: "bulk-lock",
  label: "Lock",
  level: "rows",
  processor: "backend",
  value: "/x/bulk-lock",
};
const rowBlock: TDbActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/x/block",
};

interface SetupOpts {
  level?: "auto" | "table" | "rows" | "row";
  selectedRows?: unknown[];
  table?: TDbActionInfo[];
  rows?: TDbActionInfo[];
  row?: TDbActionInfo[];
  defaultTable?: TDbActionInfo;
  defaultRows?: TDbActionInfo;
  defaultRow?: TDbActionInfo;
  slot?: (scope: Record<string, unknown>) => unknown;
}

function setup(opts: SetupOpts = {}) {
  const actionFn = vi.fn(async () => ({ ok: true }));
  const client = {
    meta: () => Promise.resolve({} as never),
    pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
    action: actionFn,
    remove: () => Promise.resolve({ deletedCount: 0 }),
  } as unknown as Client;
  let state!: ReactiveTableState;
  const Host = defineComponent({
    setup() {
      const { state: s, internals } = createTableState({
        client,
        query: { queryOnMount: false },
      });
      state = s;
      const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
      def.actions = {
        table: opts.table ?? [],
        row: opts.row ?? [],
        rows: opts.rows ?? [],
        default: {
          table: opts.defaultTable,
          row: opts.defaultRow,
          rows: opts.defaultRows,
        },
      };
      internals.init(def);
      if (opts.selectedRows) state.selectedRows.value = opts.selectedRows;
      provideTableContext({ state, client, controls: {} });
      return () =>
        h(
          AsTableActions,
          { level: opts.level ?? "auto" },
          opts.slot ? { default: opts.slot } : undefined,
        );
    },
  });
  const wrapper = mount(Host);
  return { wrapper, state, actionFn };
}

describe("<AsTableActions>", () => {
  it("renders nothing when source set is empty", () => {
    const { wrapper } = setup();
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("level=auto with 0 selected → table actions, default = table", () => {
    const def: TDbActionInfo = { ...tableExport, default: true };
    const { wrapper } = setup({ table: [def], defaultTable: def });
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(wrapper.find("button").text()).toContain("Export");
  });

  it("level=auto with ≥2 selected → rows actions, default = rows", () => {
    const def: TDbActionInfo = { ...rowsBulk, default: true };
    const { wrapper } = setup({
      rows: [def],
      defaultRows: def,
      selectedRows: ["a", "b"],
    });
    expect(wrapper.find("button").text()).toContain("Lock");
  });

  it("level=auto with exactly 1 selected → rows + trailing row actions appear in dropdown", () => {
    const def: TDbActionInfo = { ...rowsBulk, default: true };
    const { wrapper } = setup({
      rows: [def],
      row: [rowBlock],
      defaultRows: def,
      selectedRows: ["only"],
    });
    expect(wrapper.find(".as-table-actions-more").exists()).toBe(true);
  });

  it("forced level=table ignores selectedCount, default button click renders default", async () => {
    const def: TDbActionInfo = { ...tableExport, default: true };
    const { wrapper } = setup({
      level: "table",
      table: [def],
      defaultTable: def,
      selectedRows: ["a", "b"],
    });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(wrapper.find("button").text()).toContain("Export");
  });

  it("forced level=rows passes selectedRows as identifier-object array", async () => {
    const def: TDbActionInfo = { ...rowsBulk, default: true };
    const { wrapper, actionFn } = setup({
      level: "rows",
      rows: [def],
      defaultRows: def,
      // Whole-row objects (default `rowValueFn = (row) => row`) carry the
      // preferredId field — `extractIdentifier` picks `id` from each.
      selectedRows: [{ id: "a", name: "A" }, { id: "b" }, { id: "c" }],
    });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith(
      "bulk-lock",
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      undefined,
    );
  });

  it("default button click invokes default with the resolved identifier objects", async () => {
    const def: TDbActionInfo = { ...rowsBulk, default: true };
    const { wrapper, actionFn } = setup({
      level: "rows",
      rows: [def],
      defaultRows: def,
      selectedRows: [{ id: "a" }, { id: "b" }],
    });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("bulk-lock", [{ id: "a" }, { id: "b" }], undefined);
  });

  it("level=rows shows a rows action enabled for at least one selected row", () => {
    const def: TDbActionInfo = { ...rowsBulk, default: true };
    const { wrapper } = setup({
      rows: [def],
      defaultRows: def,
      // Union over selected rows' `$actions`: "bulk-lock" enabled for row "a"
      // surfaces the action even though row "b" doesn't allow it.
      selectedRows: [
        { id: "a", $actions: ["bulk-lock"] },
        { id: "b", $actions: [] },
      ],
    });
    expect(wrapper.find("button").text()).toContain("Lock");
  });

  it("level=rows hides a rows action disabled for every selected row", () => {
    const { wrapper } = setup({
      rows: [rowsBulk],
      // No selected row allows "bulk-lock" → union gate drops it → no buttons.
      selectedRows: [
        { id: "a", $actions: [] },
        { id: "b", $actions: [] },
      ],
    });
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("scoped slot replaces built-in chrome", () => {
    const def: TDbActionInfo = { ...tableExport, default: true };
    const { wrapper } = setup({
      table: [def],
      defaultTable: def,
      slot: (scope) =>
        h("div", { class: "custom-slot", "data-level": (scope as { level: string }).level }, [
          (scope as { defaultAction: TVueTableActionInfo }).defaultAction.label,
        ]),
    });
    expect(wrapper.find(".custom-slot").exists()).toBe(true);
    expect(wrapper.find(".custom-slot").attributes("data-level")).toBe("table");
    expect(wrapper.findAll("button.as-table-actions-btn")).toHaveLength(0);
  });
});
