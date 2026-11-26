import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import {
  createFormDef,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
  setValueHelpCacheTtl,
  type MetaResponse,
  type ValueHelpInfo,
} from "@atscript/ui";
import { AsForm, createDefaultTypes } from "@atscript/vue-form";
import AsRefPicker from "../components/defaults/as-ref-picker.vue";
import AsValueHelpTable from "../components/internal/as-value-help-table.vue";
import type { ReactiveTableState } from "../types";

// Since 0.1.190: the reference field's picker dialog. It lists the binding's columns in
// the field's scope (host values included), and a row picked there goes through the
// field's one pick path — the clicked row, so the fills come from it.

type Row = Record<string, unknown>;

const CITIES: Row[] = [
  { code: "SP", name: "Seville", country: "ES", region: "south" },
  { code: "SP", name: "Spoleto", country: "IT", region: "centre" },
  { code: "BER", name: "Berlin", country: "DE", region: "east" },
];

function cityMeta(searchable: boolean): MetaResponse {
  const city = defineAnnotatedType("object");
  for (const [name, ann] of [
    ["country", "meta.id"],
    ["code", "meta.id"],
    ["name", "ui.dict.label"],
    ["region", undefined],
  ] as const) {
    const p = defineAnnotatedType().designType("string");
    if (ann) p.annotate(ann as keyof AtscriptMetadata, true as never);
    city.prop(name, p.$type);
  }
  return {
    type: serializeAnnotatedType(city.$type),
    fields: Object.fromEntries(
      ["country", "code", "name", "region"].map((n) => [n, { sortable: true, filterable: true }]),
    ),
    primaryKeys: ["country", "code"],
    preferredId: ["country", "code"],
    crud: { query: [], pages: [], one: [] },
    actions: [],
    searchable,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

/** The rows a filter (`{ country }`, possibly inside `$and`) lets through. */
function filtered(filter: unknown): Row[] {
  const conds = (filter as { $and?: Row[] } | undefined)?.$and ?? (filter ? [filter as Row] : []);
  return CITIES.filter((row) => conds.every((c) => !("country" in c) || c.country === row.country));
}

const CITY: ValueHelpInfo = {
  url: "/cities",
  targetField: "code",
  hostFilter: [{ target: "country", local: "country" }],
  fill: [
    { local: "cityName", target: "name" },
    { local: "country", target: "country" },
  ],
  columns: ["code", "name", "country"],
};

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  setValueHelpCacheTtl(5000);
  document.body.innerHTML = "";
});

async function mountPicker(initial: Row, opts: { searchable?: boolean; readonly?: boolean } = {}) {
  setValueHelpCacheTtl(-1);
  const pages = vi.fn(async (q: { filter?: unknown }) => {
    const data = filtered(q.filter);
    return { data, count: data.length, page: 1, itemsPerPage: 100, pages: 1 };
  });
  const query = vi.fn(async (q: { filter?: unknown }) => filtered(q.filter));
  const meta = cityMeta(opts.searchable ?? false);
  setDefaultClientFactory(
    () => ({ meta: () => Promise.resolve(meta), pages, query, invalidateMeta: () => {} }) as never,
  );
  const str = (label: string) =>
    defineAnnotatedType()
      .designType("string")
      .annotate("meta.label" as keyof AtscriptMetadata, label as never);
  const city = str("City").annotate("ui.form.type" as keyof AtscriptMetadata, "ref" as never);
  if (opts.readonly) city.annotate("meta.readonly" as keyof AtscriptMetadata, true as never);
  const form = defineAnnotatedType("object")
    .prop("country", str("Country").optional().$type)
    .prop("city", city.$type)
    .prop("cityName", str("City name").optional().$type).$type;
  const def = createFormDef(form);
  def.fields.find((f) => f.path === "city")!.valueHelpInfo = CITY;
  const formData = reactive({ value: initial }) as { value: Row };
  const wrapper = mount(
    AsForm as never,
    {
      props: { def, formData, types: { ...createDefaultTypes(), ref: AsRefPicker } },
      attachTo: document.body,
    } as never,
  );
  await flushPromises();
  await nextTick();
  return { wrapper, formData, pages, query };
}

type Wrapper = Awaited<ReturnType<typeof mountPicker>>["wrapper"];

/** Opens the dialog with the button after the input; the dialog's table state. */
async function openDialog(wrapper: Wrapper): Promise<ReactiveTableState> {
  await wrapper.find(".as-ref-picker-browse").trigger("click");
  await flushPromises();
  await nextTick();
  await flushPromises();
  const table = wrapper.findComponent(AsValueHelpTable as never) as unknown as {
    vm: { $: { setupState: { innerState: ReactiveTableState } } };
  };
  return table.vm.$.setupState.innerState;
}

const lastFilter = (fn: ReturnType<typeof vi.fn>) =>
  (fn.mock.calls.at(-1)![0] as { filter?: unknown }).filter;

describe("AsRefPicker — the picker dialog of a reference field (since 0.1.190)", () => {
  it("lists the binding's columns in the field's scope, with the host value", async () => {
    const { wrapper, pages } = await mountPicker({ country: "IT" });
    const state = await openDialog(wrapper);
    expect(state.columnNames.value).toEqual(["code", "name", "country"]);
    expect(lastFilter(pages)).toEqual({ country: "IT" });
    const select = (pages.mock.calls.at(-1)![0] as { controls: { $select: string[] } }).controls
      .$select;
    expect(select).toEqual(expect.arrayContaining(["code", "name", "country"]));
  });

  it("a double-click picks the clicked row through the pick path, and closes", async () => {
    const { wrapper, formData } = await mountPicker({});
    const state = await openDialog(wrapper);
    // both cities coded "SP" are listed: no host value narrows the dictionary
    expect(state.totalCount.value).toBe(3);
    state.viewportRowCount.value = 5;
    await flushPromises();
    await nextTick();
    const rows = [...document.querySelectorAll(".as-value-help-dialog-content tbody tr")];
    const spoleto = rows.find((tr) => tr.textContent?.includes("Spoleto"))!;
    spoleto.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await flushPromises();
    expect(formData.value).toMatchObject({ city: "SP", cityName: "Spoleto", country: "IT" });
    await nextTick();
    expect(document.querySelector(".as-value-help-dialog-content")).toBeNull();
  });

  it("“See all” under the list opens the dialog searching for the typed text", async () => {
    const { wrapper, pages } = await mountPicker({}, { searchable: true });
    const input = wrapper.find<HTMLInputElement>(".as-ref-input");
    await input.trigger("focus");
    input.element.value = "Spo";
    await input.trigger("input");
    await flushPromises();
    const seeAll = document.querySelector<HTMLButtonElement>(".as-ref-picker-see-all")!;
    expect(seeAll.textContent?.trim()).toBe("See all");
    seeAll.click();
    await flushPromises();
    await nextTick();
    await flushPromises();
    const controls = (pages.mock.calls.at(-1)![0] as { controls: Record<string, unknown> })
      .controls;
    expect(controls.$search).toBe("Spo");
    // the list closed behind the dialog
    expect(document.querySelector(".as-ref-content")).toBeNull();
  });

  it("closing the dialog opened by “See all” puts the focus back into the field, list closed", async () => {
    const { wrapper } = await mountPicker({});
    const input = wrapper.find<HTMLInputElement>(".as-ref-input");
    input.element.focus();
    await flushPromises();
    // a click focuses the button first, as a browser does
    const seeAll = document.querySelector<HTMLButtonElement>(".as-ref-picker-see-all")!;
    seeAll.focus();
    seeAll.click();
    await flushPromises();
    await nextTick();
    await flushPromises();
    document.querySelector<HTMLButtonElement>(".as-value-help-dialog-close")!.click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
    expect(document.querySelector(".as-value-help-dialog-content")).toBeNull();
    expect(document.activeElement).toBe(input.element);
    expect(document.querySelector(".as-ref-content")).toBeNull();
  });

  it("a read-only field has no picker button", async () => {
    const { wrapper } = await mountPicker({ city: "BER" }, { readonly: true });
    expect(wrapper.find(".as-ref-input").exists()).toBe(true);
    expect(wrapper.find(".as-ref-picker-browse").exists()).toBe(false);
  });
});
