// @vitest-environment happy-dom
//
// Perf contract of the standalone table body: every row is its own component,
// so a change that touches one row (active row, one selection) re-renders that
// row only — and the renderer's cell slots still update whenever their content
// could change. The built-in default cell renders inline with output identical
// to `<AsTableCellValue>`.
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import AsTable from "../components/as-table.vue";
import AsTableCellValue from "../components/defaults/as-table-cell-value.vue";
import { provideCellLocale, useCellLocale } from "../composables/use-cell-locale";
import { mockColumn, mountWithTableContext } from "./helpers";

const columns = [mockColumn("name"), mockColumn("qty", { type: "number" })];
const makeRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `n${i + 1}`, qty: i * 1000 }));

function setup(opts: { rows?: Record<string, unknown>[]; slots?: Record<string, unknown> } = {}) {
  const rows = opts.rows ?? makeRows(20);
  return mountWithTableContext(AsTable, {
    columns,
    seedRows: rows,
    selection: { rowValueFn: (row) => row.id },
    props: { columns, select: "multi" },
    slots: opts.slots as never,
  });
}

const bodyRows = (el: Element) => Array.from(el.querySelectorAll<HTMLElement>("tbody tr"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("row render isolation", () => {
  it("a cursor move or one selection re-renders only the affected rows", async () => {
    let renders = 0;
    const { state, wrapper } = setup({
      slots: {
        "cell-name": ({ value }: { value: unknown }) => {
          renders++;
          return h("b", String(value));
        },
      },
    });
    await nextTick();
    expect(bodyRows(wrapper.element)).toHaveLength(20);
    expect(renders).toBe(20);

    renders = 0;
    state.activeIndex.value = 3;
    await nextTick();
    expect(renders).toBeLessThanOrEqual(1);
    state.activeIndex.value = 4;
    await nextTick();
    expect(renders).toBeLessThanOrEqual(3);
    expect(bodyRows(wrapper.element)[4]!.classList.contains("as-table-row-active")).toBe(true);
    expect(bodyRows(wrapper.element)[3]!.classList.contains("as-table-row-active")).toBe(false);

    renders = 0;
    state.selectedRows.value = [7];
    await nextTick();
    expect(renders).toBeLessThanOrEqual(1);
    expect(bodyRows(wrapper.element)[6]!.getAttribute("aria-selected")).toBe("true");
    expect(bodyRows(wrapper.element)[5]!.getAttribute("aria-selected")).toBe("false");
  });

  it("a cell slot reading reactive state still updates", async () => {
    const suffix = ref("!");
    const { wrapper } = setup({
      rows: makeRows(3),
      slots: {
        "cell-name": ({ value }: { value: unknown }) => h("b", `${String(value)}${suffix.value}`),
      },
    });
    await nextTick();
    expect(bodyRows(wrapper.element)[0]!.textContent).toContain("n1!");
    suffix.value = "?";
    await nextTick();
    expect(bodyRows(wrapper.element).every((tr) => tr.textContent!.includes("?"))).toBe(true);
  });

  it("a consumer that swaps its slot functions re-renders every row", async () => {
    // The closure captures a NON-reactive label: only a re-render of the row
    // can pick the new one up.
    const mode = ref("a");
    const withSelect = ref(false);
    const Host = defineComponent({
      setup(_, { attrs }) {
        return () => {
          const label = mode.value;
          const slots: Record<string, unknown> = {
            "cell-name": ({ value }: { value: unknown }) => h("b", `${label}:${String(value)}`),
          };
          if (withSelect.value) {
            slots["cell-__select"] = ({ selected }: { selected: boolean }) =>
              h("i", { class: "custom-select" }, selected ? "x" : "o");
          }
          return h(AsTable, attrs, slots as never);
        };
      },
    });
    const { wrapper } = mountWithTableContext(Host, {
      columns,
      seedRows: makeRows(4),
      selection: { rowValueFn: (row) => row.id },
      props: { columns, select: "multi" },
    });
    await nextTick();
    expect(bodyRows(wrapper.element).map((tr) => tr.querySelector("b")!.textContent)).toEqual([
      "a:n1",
      "a:n2",
      "a:n3",
      "a:n4",
    ]);
    expect(wrapper.element.querySelectorAll("tbody .as-table-checkbox")).toHaveLength(4);

    mode.value = "b";
    await nextTick();
    expect(bodyRows(wrapper.element).map((tr) => tr.querySelector("b")!.textContent)).toEqual([
      "b:n1",
      "b:n2",
      "b:n3",
      "b:n4",
    ]);

    withSelect.value = true;
    await nextTick();
    expect(wrapper.element.querySelectorAll("tbody .custom-select")).toHaveLength(4);
    expect(wrapper.element.querySelectorAll("tbody .as-table-checkbox")).toHaveLength(0);
  });

  it("a cell slot the consumer adds / removes later takes over / releases its column", async () => {
    const withQty = ref(false);
    const Host = defineComponent({
      setup(_, { attrs }) {
        return () =>
          h(
            AsTable,
            attrs,
            (withQty.value
              ? { "cell-qty": ({ value }: { value: unknown }) => h("em", `q${String(value)}`) }
              : {}) as never,
          );
      },
    });
    const { wrapper } = mountWithTableContext(Host, {
      columns,
      seedRows: makeRows(2),
      selection: { rowValueFn: (row) => row.id },
      props: { columns, select: "none" },
    });
    await nextTick();
    expect(wrapper.element.querySelectorAll("tbody em")).toHaveLength(0);
    withQty.value = true;
    await nextTick();
    const ems = bodyRows(wrapper.element).map((tr) => tr.querySelector("em")?.textContent);
    expect(ems).toEqual(["q0", "q1000"]);
    withQty.value = false;
    await nextTick();
    expect(wrapper.element.querySelectorAll("tbody em")).toHaveLength(0);
  });
});

describe("inline default cell", () => {
  it("renders exactly what <AsTableCellValue> renders", async () => {
    const optionColumn = mockColumn("status", {
      options: [
        { key: "a", label: "Alpha" },
        { key: "a", label: "Shadowed" },
        { key: "b", label: "Beta" },
      ],
    });
    const cols = [mockColumn("name"), mockColumn("qty", { type: "number" }), optionColumn];
    const rows = [
      { id: 1, name: "x", qty: 1234.5, status: "a" },
      { id: 2, name: null, qty: "oops", status: "zzz" },
    ];
    const { wrapper } = mountWithTableContext(AsTable, {
      columns: cols,
      seedRows: rows,
      selection: { rowValueFn: (row) => row.id },
      props: { columns: cols, select: "none" },
    });
    await nextTick();
    const trs = bodyRows(wrapper.element);
    rows.forEach((row, r) => {
      cols.forEach((column, c) => {
        const reference = mount(AsTableCellValue, {
          props: { row, column },
          attrs: { role: "gridcell" },
        });
        const td = trs[r]!.querySelectorAll("td")[c]!;
        expect(td.outerHTML).toBe(reference.element.outerHTML);
        reference.unmount();
      });
    });
  });
});

describe("useCellLocale", () => {
  it("shares one pair of computeds per provider", () => {
    const seen: ReturnType<typeof useCellLocale>[] = [];
    const Probe = defineComponent({
      setup() {
        seen.push(useCellLocale());
        return () => null;
      },
    });
    const source = { language: "de-DE" };
    const Provider = defineComponent({
      props: { src: { type: Object, required: true } },
      setup(props) {
        provideCellLocale(props.src as never);
        return () => [h(Probe), h(Probe)];
      },
    });
    const other = { language: "fr-FR" };
    mount(
      defineComponent({
        render: () => [h(Provider, { src: source }), h(Provider, { src: other })],
      }),
    );
    expect(seen).toHaveLength(4);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[2]).toBe(seen[3]);
    expect(seen[0]).not.toBe(seen[2]);
    expect(seen[0]!.locale.value).toBe("de-DE");
    expect(seen[2]!.locale.value).toBe("fr-FR");
  });
});
