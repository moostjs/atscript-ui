// @vitest-environment happy-dom
//
// Regression — table nav used to `preventDefault()` Enter before looking at
// the event target, so a `<button>` (or link, or form control) inside a
// custom cell could never be pressed with the keyboard: the table ate the
// key and activated the row instead. Space / Enter now stay with an
// interactive descendant unless it opts back in with `data-as-nav-keys`.
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { ListboxRoot } from "reka-ui";
import AsTableBase from "../components/internal/as-table-base.vue";
import AsWindowTableBase from "../components/internal/as-window-table-base.vue";
import { provideTableContext } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import {
  captureMainActions,
  kbd,
  mockColumn,
  mountTableState,
  mountWithTableContext,
  seedWindowCache,
} from "./helpers";

/**
 * Build a keydown whose `target` is `el` and whose `currentTarget` is the
 * guard boundary (happy-dom won't set either for a manually dispatched
 * event). `boundary` defaults to none — the walk then runs to the top.
 */
function keyOn(el: Element, key: string, boundary?: Element): KeyboardEvent {
  const ev = kbd({ key });
  Object.defineProperty(ev, "target", { value: el, configurable: true });
  if (boundary) Object.defineProperty(ev, "currentTarget", { value: boundary, configurable: true });
  return ev;
}

function cell(inner: Element): HTMLElement {
  const td = document.createElement("td");
  const tr = document.createElement("tr");
  tr.appendChild(td);
  td.appendChild(inner);
  return td;
}

function stateWithRows(): ReactiveTableState {
  const { state } = mountTableState({ columns: [mockColumn("name")] });
  seedWindowCache(state, [{ id: 1 }, { id: 2 }], 2);
  state.setActive(0);
  return state;
}

describe("handleNavKey — interactive descendants keep Enter/Space", () => {
  it("leaves Enter to a <button> inside a cell and does not activate the row", () => {
    const state = stateWithRows();
    const { captured } = captureMainActions(state);
    const button = document.createElement("button");
    cell(button);

    const ev = keyOn(button, "Enter");
    state.handleNavKey(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it("still activates the row when Enter lands on the cell itself", () => {
    const state = stateWithRows();
    const { captured } = captureMainActions(state);
    const td = cell(document.createElement("span"));

    const ev = keyOn(td, "Enter");
    state.handleNavKey(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it("an element with data-as-nav-keys hands Enter back to the table", () => {
    const state = stateWithRows();
    const { captured } = captureMainActions(state);
    const button = document.createElement("button");
    button.setAttribute("data-as-nav-keys", "");
    cell(button);

    const ev = keyOn(button, "Enter");
    state.handleNavKey(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it("leaves Space to an <input> inside a cell instead of toggling selection", () => {
    const state = stateWithRows();
    const input = document.createElement("input");
    cell(input);

    const ev = keyOn(input, " ");
    state.handleNavKey(ev, { mode: "multi" });

    expect(ev.defaultPrevented).toBe(false);
    expect(state.selectedRows.value).toEqual([]);
  });

  it("does not guard the search-input bridge: its handler is bound ON the input", () => {
    const state = stateWithRows();
    const { captured } = captureMainActions(state);
    const input = document.createElement("input");
    cell(input);

    // The bridge is wired as `@keydown` on the input itself, so target and
    // boundary are the same element and the guard walk never starts.
    const ev = keyOn(input, "Enter", input);
    state.handleNavKey(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it("guards an interactive target even when the caller passes no options", () => {
    const state = stateWithRows();
    const { captured } = captureMainActions(state);
    const button = document.createElement("button");
    const td = cell(button);

    const ev = keyOn(button, "Enter", td);
    state.handleNavKey(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(captured).toHaveLength(0);
  });
});

describe("<AsTableBase> — Enter on a control inside a custom cell", () => {
  it("does not consume the key nor fire the row's main action", async () => {
    const { state } = mountTableState({ columns: [mockColumn("name")] });
    const rows = [{ id: 1, name: "Ann" }];
    seedWindowCache(state, rows, 1);
    state.setActive(0);
    const { captured } = captureMainActions(state);

    const Host = defineComponent({
      setup() {
        provideTableContext({ state, client: {} as never, controls: {} });
        return () =>
          h(
            AsTableBase as unknown as Parameters<typeof h>[0],
            { columns: [mockColumn("name")], rows, sorters: [], stretch: false },
            { "cell-name": () => h("button", { class: "cell-btn", type: "button" }, "Open") },
          );
      },
    });
    const wrapper = mount(Host, { attachTo: document.body });
    const button = wrapper.element.querySelector(".cell-btn") as HTMLElement;
    expect(button).not.toBeNull();

    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    button.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(captured).toHaveLength(0);
    wrapper.unmount();
    document.body.innerHTML = "";
  });
});

describe("<AsWindowTableBase> — Space on the row selection control", () => {
  it("toggles that row even though role=checkbox is an interactive target", async () => {
    const { state } = mountTableState({ columns: [mockColumn("name")] });
    seedWindowCache(
      state,
      [
        { id: 1, name: "Ann" },
        { id: 2, name: "Bob" },
      ],
      2,
    );
    state.viewportRowCount.value = 2;

    const Host = defineComponent({
      setup() {
        provideTableContext({ state, client: {} as never, controls: {} });
        return () =>
          h(AsWindowTableBase as unknown as Parameters<typeof h>[0], {
            rowHeight: 32,
            select: "multi",
          });
      },
    });
    const wrapper = mount(Host, { attachTo: document.body });
    await nextTick();

    const boxes = Array.from(
      (wrapper.element as Element).querySelectorAll(".as-td-select .as-table-checkbox"),
    ) as HTMLElement[];
    expect(boxes.length).toBeGreaterThan(1);
    expect(boxes[1]!.getAttribute("aria-label")).toBe("Select row");

    boxes[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();

    expect(state.selectedRows.value).toHaveLength(1);
    wrapper.unmount();
    document.body.innerHTML = "";
  });
});

describe("<AsTableBase> — Reka-wrapped rendering keeps Space for the item", () => {
  it("renders no checkbox role / tabindex / keydown on the select cell", async () => {
    const rows = [{ id: 1, name: "Ann" }];
    const columns = [mockColumn("name")];
    const { wrapper, state } = mountWithTableContext(ListboxRoot, {
      columns,
      seedRows: rows,
      slots: {
        default: (() =>
          h(AsTableBase as unknown as Parameters<typeof h>[0], {
            renderMode: "listbox",
            columns,
            rows,
            sorters: [],
            rowValueFn: (row: Record<string, unknown>) => row.id,
          })) as never,
      },
    });
    await nextTick();

    // In combobox / listbox mode the parent Reka root owns keyboard handling:
    // a `role="checkbox"` + Space handler here would swallow the key before
    // the `ComboboxItem` could select the row.
    const cell = wrapper.element.querySelector(".as-td-select .as-table-checkbox") as HTMLElement;
    expect(cell).not.toBeNull();
    expect(cell.getAttribute("role")).toBeNull();
    expect(cell.getAttribute("tabindex")).toBeNull();

    // Space reaches the `ListboxItem`, which handles it itself — the table
    // must not divert it into `state.selectedRows` (state selection is the
    // standalone renderer's channel, not this one).
    cell.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    await nextTick();
    expect(state.selectedRows.value).toEqual([]);
  });
});
