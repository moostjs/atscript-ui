// @vitest-environment happy-dom
//
// Regression — there was no way to mark a row unselectable, and the selection
// cells were presentational `<span>`s with no role, no `aria-checked` and no
// keyboard affordance. `<AsTable>` now takes `rowSelectable` / `rowClass` /
// `rowAttrs`, the predicate gates every selection path (click, Space, header
// select-all, select-all counting), and the cells are real checkboxes.
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import AsTable from "../components/as-table.vue";
import AsWindowTable from "../components/as-window-table.vue";
import type { RowAttrsHook, RowClassHook, RowSelectableHook } from "../types";
import { mockColumn, mountWithTableContext } from "./helpers";

const columns = [mockColumn("name")];
const rows = [
  { id: 1, name: "Ann" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cid" },
];

interface SetupOpts {
  rowSelectable?: RowSelectableHook;
  rowClass?: RowClassHook;
  rowAttrs?: RowAttrsHook;
  select?: "none" | "single" | "multi";
}

function setup(opts: SetupOpts = {}) {
  return mountWithTableContext(AsTable, {
    columns,
    seedRows: rows,
    selection: { rowValueFn: (row) => row.id },
    props: {
      columns,
      rows,
      select: opts.select ?? "multi",
      rowSelectable: opts.rowSelectable,
      rowClass: opts.rowClass,
      rowAttrs: opts.rowAttrs,
    },
  });
}

/** `<tr>` elements of the data body, in render order. */
function dataRows(wrapper: { element: Element }, selector = "tbody tr"): HTMLElement[] {
  return Array.from((wrapper.element as Element).querySelectorAll<HTMLElement>(selector));
}

function selectCell(row: HTMLElement): HTMLElement {
  const el = row.querySelector<HTMLElement>(".as-td-select .as-table-checkbox");
  if (!el) throw new Error("selection control not found");
  return el;
}

/** Nobody but Bob (id 2) may be selected. */
const lockBob: RowSelectableHook = (row) => (row.id === 2 ? "Locked by another user" : true);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<AsTable> rowSelectable", () => {
  it("blocks a click on an ineligible row and allows an eligible one", async () => {
    const { wrapper, state } = setup({ rowSelectable: lockBob });
    const [ann, bob] = dataRows(wrapper);

    bob!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);

    ann!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([1]);
  });

  it("blocks the Space toggle on an ineligible active row", async () => {
    const { wrapper, state } = setup({ rowSelectable: lockBob });
    state.setActive(1);
    await nextTick();

    const tbody = wrapper.element.querySelector("tbody") as HTMLElement;
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    tbody.dispatchEvent(ev);
    await nextTick();

    expect(ev.defaultPrevented).toBe(true);
    expect(state.selectedRows.value).toEqual([]);

    state.setActive(0);
    tbody.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(state.selectedRows.value).toEqual([1]);
  });

  it("surfaces the disabled reason on the selection control", () => {
    const { wrapper } = setup({ rowSelectable: lockBob });
    const [ann, bob] = dataRows(wrapper);

    const eligible = selectCell(ann!);
    expect(eligible.getAttribute("role")).toBe("checkbox");
    expect(eligible.getAttribute("aria-checked")).toBe("false");
    expect(eligible.getAttribute("aria-label")).toBe("Select row");
    expect(eligible.getAttribute("aria-disabled")).toBeNull();
    expect(eligible.getAttribute("tabindex")).toBe("0");

    const blocked = selectCell(bob!);
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(blocked.getAttribute("title")).toBe("Locked by another user");
    expect(blocked.getAttribute("aria-label")).toBe("Select row, Locked by another user");
    expect(blocked.className).toContain("as-table-checkbox-disabled");
    expect(bob!.getAttribute("data-selectable")).toBe("false");
    expect(ann!.getAttribute("data-selectable")).toBeNull();
  });

  it("Space on an eligible selection control toggles just that row", async () => {
    const { wrapper, state } = setup({ rowSelectable: lockBob });
    const [, , cid] = dataRows(wrapper);

    selectCell(cid!).dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();

    expect(state.selectedRows.value).toEqual([3]);
  });

  it("excludes ineligible rows from select-all and from its count", async () => {
    const { wrapper, state } = setup({ rowSelectable: lockBob });
    const headerBox = wrapper.element.querySelector(
      ".as-th-select .as-table-checkbox",
    ) as HTMLElement;

    headerBox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();

    expect(state.selectedRows.value).toEqual([1, 3]);
    // Every SELECTABLE row is picked, so the header reads fully checked.
    expect(
      (
        wrapper.element.querySelector(".as-th-select .as-table-checkbox") as HTMLElement
      ).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps a pre-selected ineligible pk through select-all and still reads 'all'", async () => {
    const { wrapper, state } = setup({ rowSelectable: lockBob });
    // Bob (2) is ineligible but was already selected — by an external
    // `v-model`, or by a predicate that only just started rejecting him.
    state.selectedRows.value = [2];
    await nextTick();

    const headerBox = () =>
      wrapper.element.querySelector(".as-th-select .as-table-checkbox") as HTMLElement;
    headerBox().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();

    expect(state.selectedRows.value).toEqual([1, 2, 3]);
    // Every ELIGIBLE row is picked, so the ineligible leftover must not hold
    // the header back at "some".
    expect(headerBox().getAttribute("aria-checked")).toBe("true");
  });

  it("activates the header select-all from the keyboard", async () => {
    const { wrapper, state } = setup();
    const headerBox = wrapper.element.querySelector(
      ".as-th-select .as-table-checkbox",
    ) as HTMLElement;
    expect(headerBox.getAttribute("aria-label")).toBe("Select all rows");

    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    headerBox.dispatchEvent(space);
    await nextTick();
    expect(space.defaultPrevented).toBe(true);
    expect(state.selectedRows.value).toEqual([1, 2, 3]);

    wrapper.element
      .querySelector(".as-th-select .as-table-checkbox")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);
  });
});

describe("<AsWindowTable> rowSelectable", () => {
  function setupWindow(rowSelectable?: RowSelectableHook) {
    const mounted = mountWithTableContext(AsWindowTable, {
      columns,
      seedRows: rows,
      selection: { rowValueFn: (row) => row.id },
      props: { rowHeight: 32, select: "multi", rowSelectable },
    });
    mounted.state.viewportRowCount.value = rows.length;
    return mounted;
  }

  it("blocks a click on an ineligible row and marks its control disabled", async () => {
    const { wrapper, state } = setupWindow(lockBob);
    await nextTick();
    const windowRows = dataRows(wrapper, "tbody tr.as-window-data-row");
    expect(windowRows).toHaveLength(3);

    windowRows[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);
    expect(selectCell(windowRows[1]!).getAttribute("aria-disabled")).toBe("true");
    expect(selectCell(windowRows[1]!).getAttribute("aria-label")).toBe(
      "Select row, Locked by another user",
    );

    windowRows[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([1]);
  });

  it("excludes ineligible rows from the header select-all", async () => {
    const { wrapper, state } = setupWindow(lockBob);
    await nextTick();
    const headerBox = wrapper.element.querySelector(
      ".as-th-select .as-table-checkbox",
    ) as HTMLElement;

    headerBox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();

    expect(state.selectedRows.value).toEqual([1, 3]);
  });
});

describe("<AsTable> rowClass / rowAttrs", () => {
  it("applies rowClass to the row element", () => {
    const { wrapper } = setup({
      rowClass: (row) => ({ "row-flagged": row.id === 2 }),
    });
    const [ann, bob] = dataRows(wrapper);
    expect(bob!.className).toContain("row-flagged");
    expect(ann!.className).not.toContain("row-flagged");
  });

  it("applies rowAttrs but never lets them rewrite the framework's own attributes", () => {
    const { wrapper } = setup({
      rowAttrs: (row) => ({
        "data-row-kind": "custom",
        title: `row ${String(row.id)}`,
        role: "presentation",
        "aria-selected": "true",
      }),
    });
    const [ann] = dataRows(wrapper);
    expect(ann!.getAttribute("data-row-kind")).toBe("custom");
    expect(ann!.getAttribute("title")).toBe("row 1");
    expect(ann!.getAttribute("role")).toBe("row");
    expect(ann!.getAttribute("aria-selected")).toBe("false");
  });
});
