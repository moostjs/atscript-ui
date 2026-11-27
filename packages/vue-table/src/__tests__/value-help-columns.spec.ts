import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import {
  VALUE_HELP_OPTIONS_CAP,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
  type ColumnDef,
  type MetaResponse,
  type ValueHelpInfo,
} from "@atscript/ui";
import AsFilterValueHelp from "../components/internal/as-filter-value-help.vue";
import AsValueHelpTable from "../components/internal/as-value-help-table.vue";
import { useBoundSelectColumn } from "../composables/use-value-pickers";
import { createMockClient } from "./helpers";

// Since 0.1.190: `@ui.valueHelp.column` sets the columns of the binding's dialog,
// and every value-help read selects the committed field, the columns and the
// fill targets (one select rule).

function cityMeta(): MetaResponse {
  const city = defineAnnotatedType("object");
  const prop = (name: string, ann?: string) => {
    const p = defineAnnotatedType().designType("string");
    p.annotate("meta.label" as keyof AtscriptMetadata, name as never);
    if (ann) p.annotate(ann as keyof AtscriptMetadata, true as never);
    city.prop(name, p.$type);
  };
  prop("code", "meta.id");
  prop("name", "ui.dict.label");
  prop("region");
  prop("country");
  prop("population");
  const fields = Object.fromEntries(
    ["code", "name", "region", "country", "population"].map((n) => [
      n,
      { sortable: true, filterable: true },
    ]),
  );
  return {
    type: serializeAnnotatedType(city.$type),
    fields,
    primaryKeys: ["code"],
    preferredId: ["code"],
    crud: { query: [], pages: [], one: [] },
    actions: [],
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

const column = (info: ValueHelpInfo): ColumnDef => ({
  path: "city",
  label: "City",
  type: "ref",
  valueKind: "string",
  sortable: true,
  filterable: true,
  nullable: true,
  order: 0,
  valueHelpInfo: info,
});

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  document.body.innerHTML = "";
});

async function mountDialog(info: ValueHelpInfo) {
  const { client, pagesFn } = createMockClient({ meta: cityMeta(), data: [] });
  setDefaultClientFactory(() => client);
  const Wrapper = defineComponent({
    setup() {
      const conditions = ref([]);
      return () =>
        h(AsFilterValueHelp as never, { column: column(info), modelValue: conditions.value });
    },
  });
  const wrapper = mount(Wrapper, { attachTo: document.body });
  // the dictionary's table is the inner value-help table's (since 0.1.190)
  const comp = wrapper.findComponent(AsValueHelpTable as never);
  await flushPromises();
  await nextTick();
  await flushPromises();
  const state = (comp as unknown as { vm: { $: { setupState: { innerState: unknown } } } }).vm.$
    .setupState.innerState as { columnNames: { value: string[] } };
  return { state, pagesFn };
}

const selectOf = (pagesFn: ReturnType<typeof createMockClient>["pagesFn"]) =>
  (pagesFn.mock.calls.at(-1)![0] as { controls: { $select: string[] } }).controls.$select;

describe("value-help dialog columns (@ui.valueHelp.column)", () => {
  it("shows exactly the binding's columns, in order", async () => {
    const { state, pagesFn } = await mountDialog({
      url: "/cities",
      targetField: "code",
      columns: ["population", "name", "code"],
    });
    expect(state.columnNames.value).toEqual(["population", "name", "code"]);
    expect(selectOf(pagesFn)).toEqual(expect.arrayContaining(["population", "name", "code"]));
  });

  it("a column the served dictionary does not have (a hidden field) is left out", async () => {
    const { state } = await mountDialog({
      url: "/cities",
      targetField: "code",
      columns: ["zone", "name", "code"],
    });
    expect(state.columnNames.value).toEqual(["name", "code"]);
  });

  it("without columns: the dictionary view; the fill targets are selected too", async () => {
    const { state, pagesFn } = await mountDialog({
      url: "/cities",
      targetField: "code",
      fill: [{ local: "cityRegion", target: "region" }],
    });
    expect(state.columnNames.value).toEqual(["code", "name"]);
    expect(selectOf(pagesFn)).toEqual(expect.arrayContaining(["code", "name", "region"]));
    expect(selectOf(pagesFn)).not.toContain("population");
  });
});

describe("a `select`-typed dictionary column in the filter bar (since 0.1.190)", () => {
  async function pickerColumn(rows: Record<string, unknown>[], col: ColumnDef) {
    const client = {
      meta: () => Promise.resolve(cityMeta()),
      query: async () => rows,
      invalidateMeta: () => {},
    };
    setDefaultClientFactory(() => client as never);
    let picker!: { value: ColumnDef | null };
    const Harness = defineComponent({
      setup() {
        picker = useBoundSelectColumn(() => col, { texts: undefined });
        return () => h("div");
      },
    });
    mount(Harness);
    await flushPromises();
    return picker.value;
  }

  const bound: ColumnDef = {
    ...column({ url: "/cities", targetField: "code", filter: { country: { $eq: "DE" } } as never }),
    type: "select",
  };

  it("picks from the dictionary's values as literal options", async () => {
    const picked = await pickerColumn(
      [
        { code: "BER", name: "Berlin" },
        { code: "BON", name: "Bonn" },
      ],
      bound,
    );
    expect(picked).not.toHaveProperty("valueHelpInfo");
    expect(picked?.options).toEqual([
      { key: "BER", label: "Berlin", value: "BER" },
      { key: "BON", label: "Bonn", value: "BON" },
    ]);
  });

  it("past the cap, and for a column of another type: the dictionary picker", async () => {
    const many = Array.from({ length: VALUE_HELP_OPTIONS_CAP + 1 }, (_, i) => ({ code: `C${i}` }));
    expect(await pickerColumn(many, bound)).toBe(bound);
    const plain = column({ url: "/cities", targetField: "code" });
    expect(await pickerColumn([{ code: "BER" }], plain)).toBe(plain);
  });
});
