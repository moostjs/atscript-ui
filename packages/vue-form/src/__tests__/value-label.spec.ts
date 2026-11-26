import { afterEach, describe, expect, it } from "vitest";
import {
  createFormDef,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
  setValueHelpCacheTtl,
} from "@atscript/ui";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";

// Since 0.1.190: `@ui.valueLabel` shows a code with the text of a sibling field in
// read-only fields and in the reference field while it is not focused.

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
      },
    },
  },
};
const CITIES = [
  { code: "BER", name: "Berlin" },
  { code: "LYO", name: "Lyon" },
];

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  setValueHelpCacheTtl(5000);
  document.body.innerHTML = "";
});

async function mountForm(initialValue: Record<string, unknown>) {
  setValueHelpCacheTtl(-1);
  setDefaultClientFactory(
    () =>
      ({
        meta: () => Promise.resolve(CITY_META),
        query: async () => CITIES,
        invalidateMeta: () => {},
      }) as never,
  );
  const { ValueLabelForm } = await import("./fixtures/ref-fill-forms.as");
  const def = createFormDef(ValueLabelForm);
  def.fields.find((f) => f.path === "city")!.valueHelpInfo = {
    url: "/cities",
    targetField: "code",
    fill: [{ local: "cityName", target: "name" }],
  };
  def.fields.find((f) => f.path === "origin")!.valueHelpInfo = {
    url: "/cities",
    targetField: "code",
  };
  const formData = reactive({ value: initialValue }) as { value: Record<string, unknown> };
  const wrapper = mount(AsForm as any, {
    props: { def, formData, types: createDefaultTypes() },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  return { wrapper, formData };
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>["wrapper"];

function inputOf(wrapper: Wrapper, label: string) {
  const field = wrapper
    .findAll(".as-default-field")
    .find((f) => f.find(".as-field-label").text() === label);
  if (!field) throw new Error(`no field labelled ${label}`);
  return field.find<HTMLInputElement>("input");
}

describe("@ui.valueLabel in forms (since 0.1.190)", () => {
  it("a read-only field shows the code with its text, in the arrangement asked for", async () => {
    const { wrapper, formData } = await mountForm({
      home: "BER",
      homeName: "Berlin",
      zone: "Z1",
      zoneName: "Inner zone",
    });
    expect(inputOf(wrapper, "Home").element.value).toBe("BER (Berlin)");
    expect(inputOf(wrapper, "Zone").element.value).toBe("Inner zone");
    // the text follows the sibling; an empty text shows the code
    formData.value.homeName = "";
    await nextTick();
    expect(inputOf(wrapper, "Home").element.value).toBe("BER");
    // the value itself is untouched
    expect(formData.value.home).toBe("BER");
  });

  it("an editable text field edits the code", async () => {
    const { wrapper } = await mountForm({ note: "N1", noteText: "First" });
    expect(inputOf(wrapper, "Note").element.value).toBe("N1");
  });

  it("the reference field shows the text while not focused and the code while focused", async () => {
    const { wrapper, formData } = await mountForm({ city: "BER", cityName: "Berlin" });
    const input = inputOf(wrapper, "City");
    expect(input.element.value).toBe("Berlin (BER)");

    await input.trigger("focus");
    await flushPromises();
    expect(input.element.value).toBe("BER");

    // a pick writes the code and fills the text; leaving the field shows both
    const item = wrapper.findAll(".as-ref-item").find((i) => i.text().includes("Lyon"))!;
    await item.trigger("pointerup");
    await item.trigger("click");
    await flushPromises();
    expect(formData.value).toMatchObject({ city: "LYO", cityName: "Lyon" });
    await input.trigger("blur");
    await flushPromises();
    await new Promise((r) => setTimeout(r, 5));
    expect(input.element.value).toBe("Lyon (LYO)");

    // a text edited elsewhere shows at once
    formData.value.cityName = "Lyon (Rhône)";
    await nextTick();
    expect(input.element.value).toBe("Lyon (Rhône) (LYO)");
  });

  it("a read-only reference field shows the text also when focused, and opens no list", async () => {
    const { wrapper } = await mountForm({ origin: "BER", originName: "Berlin" });
    const input = inputOf(wrapper, "Origin");
    expect(input.element.value).toBe("Berlin (BER)");
    await input.trigger("focus");
    await flushPromises();
    expect(input.element.value).toBe("Berlin (BER)");
    expect(wrapper.findAll(".as-ref-item")).toHaveLength(0);
  });
});
