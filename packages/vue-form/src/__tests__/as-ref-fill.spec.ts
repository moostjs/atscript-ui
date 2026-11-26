import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFormDef,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
  setValueHelpCacheTtl,
  type ValueHelpInfo,
} from "@atscript/ui";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";

// Since 0.1.190: a value-help binding narrows its picker by values of the form
// (`hostFilter`), a pick fills other fields (`fill`), and the × clears what the last
// pick filled while the field still holds it — never a field the binding reads.

const str = { kind: "", designType: "string", tags: [] };
const CITY_META = {
  searchable: false,
  primaryKeys: ["code"],
  fields: {},
  type: {
    $v: 2,
    metadata: {},
    type: {
      kind: "object",
      tags: [],
      propsPatterns: [],
      props: {
        code: { metadata: { "meta.id": true }, type: str },
        name: { metadata: { "ui.dict.label": true }, type: str },
        country: { metadata: {}, type: str },
        region: { metadata: {}, type: str },
      },
    },
  },
};
const CITIES = [
  { code: "BER", name: "Berlin", country: "DE", region: "east" },
  { code: "BON", name: "Bonn", country: "DE", region: "west" },
  { code: "LYO", name: "Lyon", country: "FR", region: "south" },
];

const CITY: ValueHelpInfo = {
  url: "/cities",
  targetField: "code",
  hostFilter: [{ target: "country", local: "country" }],
  fill: [
    { local: "cityName", target: "name" },
    { local: "country", target: "country" },
    { local: "region", target: "region" },
  ],
};
const OFFICE: ValueHelpInfo = {
  url: "/offices",
  targetField: "code",
  fill: [{ local: "officeName", target: "name" }],
};

type Exposed = { isDirty: boolean; getPatch: () => Record<string, unknown> };

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  setValueHelpCacheTtl(5000);
  document.body.innerHTML = "";
});

async function mountFillForm(initialValue: Record<string, unknown>) {
  // no shared results: every search is asked
  setValueHelpCacheTtl(-1);
  const rows = async (req: { filter?: Record<string, unknown> }) => {
    const country = (req.filter as { country?: string } | undefined)?.country;
    return CITIES.filter((c) => !country || c.country === country);
  };
  // the city picker's searches; the office picker asks its own client
  const query = vi.fn(rows);
  setDefaultClientFactory(
    (url) =>
      ({
        meta: () => Promise.resolve(CITY_META),
        query: url === "/cities" ? query : rows,
        invalidateMeta: () => {},
      }) as never,
  );
  const { RefFillForm } = await import("./fixtures/ref-fill-forms.as");
  const def = createFormDef(RefFillForm);
  def.fields.find((f) => f.path === "city")!.valueHelpInfo = CITY;
  def.fields.find((f) => f.path === "office")!.valueHelpInfo = OFFICE;
  const formData = reactive({ value: initialValue }) as { value: Record<string, unknown> };
  const wrapper = mount(AsForm as any, {
    props: { def, formData, types: createDefaultTypes(), trackChanges: true },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  return { wrapper, formData, query, vm: wrapper.vm as unknown as Exposed };
}

type Wrapper = Awaited<ReturnType<typeof mountFillForm>>["wrapper"];

function fieldOf(wrapper: Wrapper, label: string) {
  const field = wrapper
    .findAll(".as-default-field")
    .find((f) => f.find(".as-field-label").text() === label);
  if (!field) throw new Error(`no field labelled ${label}`);
  return field;
}

async function pick(wrapper: Wrapper, label: string, text: string) {
  const input = fieldOf(wrapper, label).find<HTMLInputElement>(".as-ref-input");
  await input.trigger("focus");
  await flushPromises();
  const item = wrapper.findAll(".as-ref-item").find((i) => i.text().includes(text));
  if (!item) throw new Error(`no item ${text}`);
  await item.trigger("pointerup");
  await item.trigger("click");
  await flushPromises();
  await nextTick();
}

const lastFilter = (query: ReturnType<typeof vi.fn>) => query.mock.calls.at(-1)![0].filter;

describe("AsRef — host values narrow the picker (since 0.1.190)", () => {
  it("searches with the host value; an empty host field leaves the condition out", async () => {
    const { query, formData } = await mountFillForm({ country: "FR" });
    expect(lastFilter(query)).toEqual({ country: "FR" });

    formData.value.country = "";
    await flushPromises();
    // closed list: the next open searches again, without the condition
    expect(lastFilter(query)).toEqual({ country: "FR" });
  });

  it("a host change searches again on the next open, also for unchanged text", async () => {
    const { wrapper, query, formData } = await mountFillForm({ country: "FR" });
    formData.value.country = "DE";
    await flushPromises();
    const before = query.mock.calls.length;
    await fieldOf(wrapper, "City").find(".as-ref-input").trigger("focus");
    await flushPromises();
    expect(query.mock.calls.length).toBe(before + 1);
    expect(lastFilter(query)).toEqual({ country: "DE" });
    expect(wrapper.findAll(".as-ref-item").map((i) => i.text())).toEqual([
      expect.stringContaining("Berlin"),
      expect.stringContaining("Bonn"),
    ]);
    // while open, a host change searches at once
    formData.value.country = undefined;
    await flushPromises();
    expect(lastFilter(query)).toBeUndefined();
  });
});

describe("AsRef — a pick fills, × clears what it filled (since 0.1.190)", () => {
  it("a pick commits the value and writes the fills as tracked edits", async () => {
    const { wrapper, formData, vm } = await mountFillForm({});
    await pick(wrapper, "City", "Lyon");
    expect(formData.value).toMatchObject({
      city: "LYO",
      cityName: "Lyon",
      country: "FR",
      region: "south",
    });
    expect(vm.getPatch()).toEqual({
      city: "LYO",
      cityName: "Lyon",
      country: "FR",
      region: "south",
    });
    // each write is a committed edit, and the pick commits the field itself (`onBlur`)
    const changes = (wrapper.emitted("change") ?? []).map((e) => [e[0], e[1], e[2]]);
    expect(changes).toEqual(
      expect.arrayContaining([
        ["update", "cityName", "Lyon"],
        ["update", "country", "FR"],
        ["update", "region", "south"],
        ["update", "city", "LYO"],
      ]),
    );
  });

  it("× clears the fills that still hold what the pick wrote — never the host field", async () => {
    const { wrapper, formData } = await mountFillForm({});
    await pick(wrapper, "City", "Lyon");
    // the user edits one filled field: it is theirs now
    formData.value.region = "centre";
    await nextTick();

    await fieldOf(wrapper, "City").find(".as-ref-clear").trigger("click");
    await nextTick();
    // a required string key holds "" once cleared
    expect(formData.value.city).toBe("");
    expect(formData.value.cityName).toBeUndefined();
    expect(formData.value.region).toBe("centre");
    // `country` scopes the picker (and was filled): a clear keeps it
    expect(formData.value.country).toBe("FR");
  });

  it("a loaded record's values are not cleared: only a pick's writes are", async () => {
    const { wrapper, formData } = await mountFillForm({
      city: "BER",
      cityName: "Berlin",
      region: "east",
    });
    await fieldOf(wrapper, "City").find(".as-ref-clear").trigger("click");
    await nextTick();
    expect(formData.value.city).toBe("");
    expect(formData.value).toMatchObject({ cityName: "Berlin", region: "east" });
  });

  it("another binding's fills are not cleared, and a filled field does not cascade", async () => {
    const { wrapper, formData } = await mountFillForm({});
    await pick(wrapper, "Office", "Bonn");
    expect(formData.value).toMatchObject({ office: "BON", officeName: "Bonn" });
    await pick(wrapper, "City", "Berlin");
    await fieldOf(wrapper, "City").find(".as-ref-clear").trigger("click");
    await nextTick();
    expect(formData.value).toMatchObject({ office: "BON", officeName: "Bonn" });
    expect(formData.value.cityName).toBeUndefined();
  });
});

describe("AsRef — a field of a namespace object (since 0.1.190)", () => {
  it("reads its host value and writes its fill next to it, not in the form's root", async () => {
    setValueHelpCacheTtl(-1);
    const query = vi.fn(async (req: { filter?: Record<string, unknown> }) => {
      const country = (req.filter as { country?: string } | undefined)?.country;
      return CITIES.filter((c) => !country || c.country === country);
    });
    setDefaultClientFactory(
      () =>
        ({
          meta: () => Promise.resolve(CITY_META),
          query,
          invalidateMeta: () => {},
        }) as never,
    );
    const { ShipmentForm } = await import("./fixtures/ref-fill-forms.as");
    const def = createFormDef(ShipmentForm);
    const formData = reactive({ value: { country: "FR", shipping: { country: "DE" } } }) as {
      value: Record<string, any>;
    };
    const wrapper = mount(AsForm as any, {
      props: { def, formData, types: createDefaultTypes() },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    expect(lastFilter(query)).toEqual({ country: "DE" });

    await pick(wrapper as unknown as Wrapper, "Shipping city", "Bonn");
    expect(formData.value.shipping).toEqual({ country: "DE", city: "BON", cityName: "Bonn" });
    expect(formData.value.cityName).toBeUndefined();
  });
});

describe("a pick fills from the row picked, also where values repeat (since 0.1.190)", () => {
  // keyed by country + code: two cities share the code "SP"
  const props = CITY_META.type.type.props;
  const KEYED_META = {
    ...CITY_META,
    primaryKeys: ["country", "code"],
    type: {
      ...CITY_META.type,
      type: {
        ...CITY_META.type.type,
        props: { ...props, country: { ...props.country, metadata: { "meta.id": true } } },
      },
    },
  };
  const SPLIT = [
    { code: "SP", name: "Seville", country: "ES", region: "south" },
    { code: "SP", name: "Spoleto", country: "IT", region: "centre" },
  ];

  it("the combobox writes the clicked row's fields", async () => {
    setValueHelpCacheTtl(-1);
    setDefaultClientFactory(
      () =>
        ({
          meta: () => Promise.resolve(KEYED_META),
          query: async () => SPLIT,
          invalidateMeta: () => {},
        }) as never,
    );
    const { RefFillForm } = await import("./fixtures/ref-fill-forms.as");
    const def = createFormDef(RefFillForm);
    def.fields.find((f) => f.path === "city")!.valueHelpInfo = CITY;
    def.fields.find((f) => f.path === "office")!.valueHelpInfo = OFFICE;
    const formData = reactive({ value: {} }) as { value: Record<string, unknown> };
    const wrapper = mount(AsForm as any, {
      props: { def, formData, types: createDefaultTypes() },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    await pick(wrapper as unknown as Wrapper, "City", "Spoleto");
    expect(formData.value).toMatchObject({
      city: "SP",
      cityName: "Spoleto",
      country: "IT",
      region: "centre",
    });
    // both rows are listed, each under its own key: the dictionary's primary key, not the
    // committed value both rows hold
    await fieldOf(wrapper as unknown as Wrapper, "City")
      .find(".as-ref-input")
      .trigger("focus");
    await flushPromises();
    expect(wrapper.findAll(".as-ref-item").map((i) => i.text())).toEqual([
      expect.stringContaining("Seville"),
      expect.stringContaining("Spoleto"),
    ]);
    const keys = wrapper
      .findAllComponents({ name: "ComboboxItem" })
      .map((item) => item.vm.$.vnode.key);
    expect(keys).toEqual(["SP\u0000ES", "SP\u0000IT"]);
  });
});
