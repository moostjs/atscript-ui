// @vitest-environment happy-dom
//
// Selection controls: `#header-__select` / `#cell-__select` slots, `selectOn`,
// and the header's scope — it acts on the LOADED rows only (a pick on another
// page survives both directions), `clearSelection()` is the real clear, and a
// windowed table offers select-all only once every row is loaded.
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import AsTable from "../components/as-table.vue";
import AsWindowTable from "../components/as-window-table.vue";
import type { RowSelectableHook, SelectAllState } from "../types";
import { mockColumn, mountWithTableContext } from "./helpers";

const columns = [mockColumn("name")];
const rows = [
  { id: 1, name: "Ann" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cid" },
];
const lockBob: RowSelectableHook = (row) => (row.id === 2 ? "Locked" : true);

type Slots = Record<string, (...args: never[]) => unknown>;

function setup(props: Record<string, unknown> = {}, slots?: Slots) {
  return mountWithTableContext(AsTable, {
    columns,
    seedRows: rows,
    selection: { rowValueFn: (row) => row.id },
    props: { columns, rows, select: "multi", ...props },
    slots,
  });
}

function setupWindow(
  props: Record<string, unknown> = {},
  opts: { slots?: Slots; totalCount?: number } = {},
) {
  const mounted = mountWithTableContext(AsWindowTable, {
    columns,
    seedRows: rows,
    totalCount: opts.totalCount,
    selection: { rowValueFn: (row) => row.id },
    props: { rowHeight: 32, select: "multi", ...props },
    slots: opts.slots,
  });
  mounted.state.viewportRowCount.value = rows.length;
  return mounted;
}

const dataRows = (root: Element, sel = "tbody tr") =>
  Array.from(root.querySelectorAll<HTMLElement>(sel));
const rowBox = (row: HTMLElement) =>
  row.querySelector<HTMLElement>(".as-td-select .as-table-checkbox")!;
const headerBox = (root: Element) =>
  root.querySelector<HTMLElement>(".as-th-select .as-table-checkbox");
const click = (el: Element) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

afterEach(() => {
  document.body.innerHTML = "";
});

// The same contract on both renderers.
describe.each([
  { name: "AsTable", mount: setup, rowSel: "tbody tr" },
  { name: "AsWindowTable", mount: setupWindow, rowSel: "tbody tr.as-window-data-row" },
])("<$name> selection", ({ mount, rowSel }) => {
  const trs = (root: Element) => dataRows(root, rowSel);

  it('selectOn "row" (default): a row click toggles', async () => {
    const { wrapper, state } = mount();
    await nextTick();
    click(trs(wrapper.element)[0]!);
    await nextTick();
    expect(state.selectedRows.value).toEqual([1]);
  });

  it('selectOn "control": a row click only moves the active row', async () => {
    const { wrapper, state } = mount({ selectOn: "control" });
    await nextTick();
    click(trs(wrapper.element)[1]!);
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);
    expect(state.activeIndex.value).toBe(1);
  });

  it('selectOn "control": the checkbox toggles without a row-click', async () => {
    const onRowClick = vi.fn();
    const { wrapper, state } = mount({ selectOn: "control", onRowClick });
    await nextTick();
    click(rowBox(trs(wrapper.element)[2]!));
    await nextTick();
    expect(state.selectedRows.value).toEqual([3]);
    expect(state.activeIndex.value).toBe(2);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('selectOn "control": Space on the active row still toggles', async () => {
    const { wrapper, state } = mount({ selectOn: "control" });
    await nextTick();
    state.setActive(0);
    const tbody = wrapper.element.querySelector("tbody")!;
    tbody.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([1]);
  });

  it('selectOn "control": the checkbox still respects rowSelectable', async () => {
    const { wrapper, state } = mount({ selectOn: "control", rowSelectable: lockBob });
    await nextTick();
    click(rowBox(trs(wrapper.element)[1]!));
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);
  });

  it("header measures and acts on the loaded rows; a pick elsewhere survives", async () => {
    const { wrapper, state } = mount();
    state.selectedRows.value = [99];
    await nextTick();
    const box = () => headerBox(wrapper.element)!;
    // No LOADED row is picked.
    expect(box().getAttribute("aria-checked")).toBe("false");

    click(box());
    await nextTick();
    expect(state.selectedRows.value).toEqual([99, 1, 2, 3]);
    expect(box().getAttribute("aria-checked")).toBe("true");

    click(box());
    await nextTick();
    expect(state.selectedRows.value).toEqual([99]);
  });

  it("partial loaded selection reads 'some' and selects the rest", async () => {
    const { wrapper, state } = mount();
    state.selectedRows.value = [2];
    await nextTick();
    expect(headerBox(wrapper.element)!.getAttribute("aria-checked")).toBe("mixed");
    click(headerBox(wrapper.element)!);
    await nextTick();
    expect(state.selectedRows.value).toEqual([2, 1, 3]);
  });

  it("header deselect leaves an ineligible pick alone", async () => {
    const { wrapper, state } = mount({ rowSelectable: lockBob });
    state.selectedRows.value = [1, 2, 3];
    await nextTick();
    expect(headerBox(wrapper.element)!.getAttribute("aria-checked")).toBe("true");
    click(headerBox(wrapper.element)!);
    await nextTick();
    expect(state.selectedRows.value).toEqual([2]);
  });

  it("the header checkbox toggles from the keyboard through the same path", async () => {
    const { wrapper, state } = mount();
    state.selectedRows.value = [99];
    await nextTick();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    headerBox(wrapper.element)!.dispatchEvent(enter);
    await nextTick();
    expect(enter.defaultPrevented).toBe(true);
    expect(state.selectedRows.value).toEqual([99, 1, 2, 3]);
  });

  it("clearSelection() empties everything, loaded or not, eligible or not", () => {
    const { state } = mount({ rowSelectable: lockBob });
    state.selectedRows.value = [2, 3, 99];
    state.clearSelection();
    expect(state.selectedRows.value).toEqual([]);
  });
});

describe("<AsTable> selection slots", () => {
  it("#cell-__select replaces the row control and receives row state + toggle", async () => {
    const seen: Record<string, unknown>[] = [];
    const { wrapper, state } = setup(
      { rowSelectable: lockBob },
      {
        "cell-__select": ((p: {
          row: { id: number };
          index: number;
          selected: boolean;
          selectable: boolean;
          reason?: string;
          toggle: () => void;
        }) => {
          seen.push({ id: p.row.id, index: p.index, selectable: p.selectable, reason: p.reason });
          return h("input", {
            type: "checkbox",
            class: "host-box",
            checked: p.selected,
            disabled: !p.selectable,
            onClick: (e: Event) => {
              e.stopPropagation();
              p.toggle();
            },
          });
        }) as never,
      },
    );
    const trs = dataRows(wrapper.element);
    expect(trs[0]!.querySelector(".as-table-checkbox")).toBeNull();
    expect(seen.slice(0, 3)).toEqual([
      { id: 1, index: 0, selectable: true, reason: undefined },
      { id: 2, index: 1, selectable: false, reason: "Locked" },
      { id: 3, index: 2, selectable: true, reason: undefined },
    ]);
    click(trs[2]!.querySelector(".host-box")!);
    await nextTick();
    expect(state.selectedRows.value).toEqual([3]);
    expect(state.activeIndex.value).toBe(2);
  });

  it("#header-__select replaces the header control and receives state, toggle, count", async () => {
    let last!: { state?: SelectAllState; toggle: () => void; selectedCount: number };
    const { wrapper, state } = setup(
      {},
      {
        "header-__select": ((p: typeof last) => {
          last = p;
          return h("span", { class: "host-header" }, `${p.state}:${p.selectedCount}`);
        }) as never,
      },
    );
    expect(headerBox(wrapper.element)).toBeNull();
    expect(wrapper.find(".host-header").text()).toBe("none:0");
    last.toggle();
    await nextTick();
    expect(state.selectedRows.value).toEqual([1, 2, 3]);
    expect(wrapper.find(".host-header").text()).toBe("all:3");
  });
});

describe("<AsWindowTable> partial dataset + slots", () => {
  it("renders no header control while part of the dataset is not loaded", async () => {
    let last!: { state?: SelectAllState; selectedCount: number };
    const { wrapper, state } = setupWindow(
      {},
      {
        totalCount: 500,
        slots: {
          "header-__select": ((p: typeof last) => {
            last = p;
            return h("span", { class: "host-header" }, String(p.selectedCount));
          }) as never,
        },
      },
    );
    state.selectedRows.value = [1, 2];
    await nextTick();
    expect(last.state).toBeUndefined();
    expect(wrapper.find(".host-header").text()).toBe("2");
  });

  it("renders the default header cell empty on a partial dataset", async () => {
    const { wrapper } = setupWindow({}, { totalCount: 500 });
    await nextTick();
    expect(wrapper.element.querySelector(".as-th-select")).not.toBeNull();
    expect(headerBox(wrapper.element)).toBeNull();
  });

  it("#cell-__select renders per row with the absolute index", async () => {
    const indexes: number[] = [];
    const { wrapper } = setupWindow(
      {},
      {
        slots: {
          "cell-__select": ((p: { index: number }) => {
            indexes.push(p.index);
            return h("span", { class: "host-cell" });
          }) as never,
        },
      },
    );
    await nextTick();
    expect(wrapper.findAll(".host-cell")).toHaveLength(3);
    expect(indexes.slice(-3)).toEqual([0, 1, 2]);
  });
});
