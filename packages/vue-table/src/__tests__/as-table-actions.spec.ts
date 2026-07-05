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
  /** Mutate the freshly-built state before the toolbar renders (e.g. seed a paginated page slice + active row). */
  patchState?: (state: ReactiveTableState) => void;
  /** Base-path mapper threaded to `state.resolveHref`. */
  resolveHref?: (url: string) => string;
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
        actions: { resolveHref: opts.resolveHref },
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
      opts.patchState?.(state);
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

  it("level=row resolves the active row on a page past the first (page-relative index)", async () => {
    // Regression: the toolbar delegates active-row resolution to
    // `state.getActiveRow()`. On page 2 (`resultsStart = 4`) `activeIndex` is
    // PAGE-RELATIVE while the cache is keyed by ABSOLUTE index — the old
    // hand-rolled `results[activeIndex - resultsStart]` math computed a
    // negative/wrong index and gated/invoked against the wrong (or undefined)
    // row. The default `rowValueFn = (row) => row`, so the invoked identifier
    // is `{ id }` lifted from whichever row resolved.
    const def: TDbActionInfo = { ...rowBlock, default: true };
    const { wrapper, actionFn } = setup({
      level: "row",
      row: [def],
      defaultRow: def,
      patchState(state) {
        // Page 2 of an 8-row, 4-per-page dataset: page slice in `results`,
        // cache keyed at ABSOLUTE indices 4..7.
        const pageRows = [
          { id: "e", $actions: ["block"] },
          { id: "f", $actions: ["block"] },
          { id: "g", $actions: ["block"] },
          { id: "h", $actions: ["block"] },
        ];
        const cache = new Map<number, Record<string, unknown>>();
        pageRows.forEach((r, i) => cache.set(4 + i, r));
        state.windowCache.value = cache;
        state.results.value = pageRows;
        state.resultsStart.value = 4;
        state.totalCount.value = 8;
        state.setActive(2); // page-relative → third row of page 2 ("g")
      },
    });
    // The row gate kept "block" (active row "g" allows it) → button renders.
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("block", { id: "g" }, undefined);
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

  // ── navigate default action rendered as a real link ─────────────────────

  describe("navigate default action as anchor", () => {
    const openDash: TDbActionInfo = {
      name: "dashboard",
      label: "Dashboard",
      level: "table",
      processor: "navigate",
      value: "/dashboard",
      default: true,
    };

    it("table-level navigate default renders an anchor with the resolveHref-mapped href", () => {
      const { wrapper } = setup({
        table: [openDash],
        defaultTable: openDash,
        resolveHref: (url) => `/base${url}`,
      });
      const a = wrapper.find("a.as-table-actions-btn");
      expect(a.exists()).toBe(true);
      expect(a.attributes("href")).toBe("/base/dashboard");
      expect(a.attributes("data-default")).toBeDefined();
      expect(wrapper.findAll("button.as-table-actions-btn")).toHaveLength(0);
    });

    it("plain left click on the anchor prevents default and invokes; mod-click stays native", async () => {
      const { wrapper, actionFn } = setup({ table: [openDash], defaultTable: openDash });
      const el = wrapper.find("a").element;

      const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      el.dispatchEvent(plain);
      await flushPromises();
      expect(plain.defaultPrevented).toBe(true);
      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(actionFn).toHaveBeenCalledWith("dashboard", undefined);

      const mod = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true,
      });
      el.dispatchEvent(mod);
      await flushPromises();
      expect(mod.defaultPrevented).toBe(false);
      expect(actionFn).toHaveBeenCalledTimes(1);
    });

    it("promptText navigate default keeps the button; mod-click confirms → window.open", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const confirmNav: TDbActionInfo = { ...openDash, promptText: "Leave?" };
      const { wrapper, state, actionFn } = setup({
        table: [confirmNav],
        defaultTable: confirmNav,
        resolveHref: (url) => `/base${url}`,
      });
      expect(wrapper.find("a").exists()).toBe(false);
      await wrapper.find("button").trigger("click", { metaKey: true, button: 0 });
      expect(state.confirmRequest.value?.message).toBe("Leave?");
      state.acceptPrompt();
      await flushPromises();
      expect(openSpy).toHaveBeenCalledWith("/base/dashboard", "_blank", "noopener,noreferrer");
      expect(actionFn).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });
  });
});
