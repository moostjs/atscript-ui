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
import { VALUE_HELP_OPTIONS_CAP } from "@atscript/ui";

// Since 0.1.190: `@ui.form.type 'select'` (or 'radio') on a field bound to a dictionary,
// with no options of its own, lists the dictionary's values; a pick fills like the
// picker's; a list longer than the cap falls back to the search picker.

const str = { kind: "", designType: "string", tags: [] };
const META = {
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
      },
    },
  },
};
const CITIES = [
  { code: "BER", name: "Berlin", country: "DE" },
  { code: "BON", name: "Bonn", country: "DE" },
  { code: "LYO", name: "Lyon", country: "FR" },
];

const CITY: ValueHelpInfo = {
  url: "/cities",
  targetField: "code",
  hostFilter: [{ target: "country", local: "country" }],
  fill: [{ local: "cityName", target: "name" }],
};

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  setValueHelpCacheTtl(5000);
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function mountSelectForm(initialValue: Record<string, unknown>, rows = CITIES) {
  setValueHelpCacheTtl(-1);
  const query = vi.fn(async (req: { filter?: Record<string, unknown> }) => {
    const country = (req.filter as { country?: string } | undefined)?.country;
    return rows.filter((c) => !country || c.country === country);
  });
  // the city dropdown's reads; the radios ask their own client
  setDefaultClientFactory(
    (url) =>
      ({
        meta: () => Promise.resolve(META),
        query: url === "/cities" ? query : async () => rows,
        invalidateMeta: () => {},
      }) as never,
  );
  const { SelectFillForm } = await import("./fixtures/ref-fill-forms.as");
  const def = createFormDef(SelectFillForm);
  def.fields.find((f) => f.path === "city")!.valueHelpInfo = CITY;
  def.fields.find((f) => f.path === "size")!.valueHelpInfo = { url: "/sizes", targetField: "code" };
  const formData = reactive({ value: initialValue }) as { value: Record<string, unknown> };
  const wrapper = mount(AsForm as any, {
    props: { def, formData, types: createDefaultTypes(), trackChanges: true },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  return { wrapper, formData, query };
}

type Wrapper = Awaited<ReturnType<typeof mountSelectForm>>["wrapper"];

function fieldOf(wrapper: Wrapper, label: string) {
  const field = wrapper
    .findAll(".as-default-field")
    .find((f) => f.find(".as-field-label").text() === label);
  if (!field) throw new Error(`no field labelled ${label}`);
  return field;
}

const optionTexts = (wrapper: Wrapper) =>
  fieldOf(wrapper, "City")
    .findAll("option")
    .map((o) => o.text());

describe("a dropdown bound to a dictionary (since 0.1.190)", () => {
  it("lists the dictionary's values in the binding's scope, after an empty option", async () => {
    const { wrapper, query } = await mountSelectForm({ country: "DE", city: "BER" });
    const read = query.mock.calls.at(-1)![0] as {
      filter?: unknown;
      controls: { $limit: number; $select: string[] };
    };
    expect(read.filter).toEqual({ country: "DE" });
    expect(read.controls.$limit).toBe(VALUE_HELP_OPTIONS_CAP + 1);
    expect(read.controls.$select).toEqual(["code", "name"]);
    expect(optionTexts(wrapper)).toEqual(["", "Berlin", "Bonn"]);
    expect(fieldOf(wrapper, "City").find<HTMLSelectElement>("select").element.value).toBe("BER");
  });

  it("a pick goes through the pick path: the fill is written; the empty option clears it", async () => {
    const { wrapper, formData } = await mountSelectForm({ country: "DE", city: "BER" });
    const select = fieldOf(wrapper, "City").find<HTMLSelectElement>("select");
    await select.setValue("BON");
    await nextTick();
    expect(formData.value).toMatchObject({ city: "BON", cityName: "Bonn" });

    select.element.selectedIndex = 0;
    await select.trigger("change");
    await nextTick();
    expect(formData.value.city).toBeUndefined();
    expect(formData.value.cityName).toBeUndefined();
    expect(formData.value.country).toBe("DE");
  });

  it("a changed host value reads the list again", async () => {
    const { wrapper, formData } = await mountSelectForm({ country: "DE", city: "LYO" });
    expect(optionTexts(wrapper)).toEqual(["", "LYO", "Berlin", "Bonn"]);
    formData.value.country = "FR";
    await flushPromises();
    await nextTick();
    expect(optionTexts(wrapper)).toEqual(["", "Lyon"]);
  });

  it("a value the list does not hold stays shown", async () => {
    const { wrapper } = await mountSelectForm({ country: "FR", city: "BER" });
    expect(optionTexts(wrapper)).toEqual(["", "BER", "Lyon"]);
  });

  it("radios list the values too", async () => {
    const { wrapper } = await mountSelectForm({});
    const radios = fieldOf(wrapper, "Size").findAll("input[type=radio]");
    expect(radios.map((r) => r.element.getAttribute("value"))).toEqual(["BER", "BON", "LYO"]);
  });

  it("more values than the cap: the search picker, with one development warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const many = Array.from({ length: VALUE_HELP_OPTIONS_CAP + 1 }, (_, i) => ({
      code: `C${i}`,
      name: `City ${i}`,
      country: "DE",
    }));
    const { wrapper } = await mountSelectForm({ city: "C1" }, many);
    await flushPromises();
    expect(fieldOf(wrapper, "City").find("select").exists()).toBe(false);
    expect(fieldOf(wrapper, "City").find(".as-ref-input").exists()).toBe(true);
    const warnings = warn.mock.calls.filter((c) => String(c[0]).includes("/cities"));
    expect(warnings).toHaveLength(1);
  });
});

describe("a dropdown narrowed by a host value (since 0.1.190)", () => {
  it("is the search picker while the list is too long, and a dropdown again once it fits", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const many = Array.from({ length: VALUE_HELP_OPTIONS_CAP + 1 }, (_, i) => ({
      code: `C${i}`,
      name: `City ${i}`,
      country: i < 3 ? "DE" : "FR",
    }));
    const { wrapper, formData } = await mountSelectForm({ city: "C1" }, many);
    expect(fieldOf(wrapper, "City").find("select").exists()).toBe(false);

    formData.value.country = "DE";
    await flushPromises();
    await nextTick();
    expect(optionTexts(wrapper)).toEqual(["", "City 0", "City 1", "City 2"]);
  });
});

describe("a dropdown value several rows hold (since 0.1.190)", () => {
  it("is committed without fills: no row is guessed", async () => {
    const rows = [
      { code: "SP", name: "Seville", country: "ES" },
      { code: "SP", name: "Spoleto", country: "IT" },
      { code: "BER", name: "Berlin", country: "DE" },
    ];
    const { wrapper, formData } = await mountSelectForm({ city: "BER" }, rows);
    const select = fieldOf(wrapper, "City").find("select");
    await select.setValue("SP");
    await flushPromises();
    expect(formData.value.city).toBe("SP");
    expect(formData.value.cityName).toBeUndefined();
    // a value one row holds fills as before
    await select.setValue("BER");
    await flushPromises();
    expect(formData.value).toMatchObject({ city: "BER", cityName: "Berlin" });
  });
});
