import { describe, expect, it, beforeAll } from "vitest";
import { defineComponent, h, nextTick, reactive, type Component } from "vue";
import { mount } from "@vue/test-utils";
import {
  UI_FORM_FN_LABEL,
  UI_FORM_FN_PLACEHOLDER,
  UI_FORM_VALIDATE,
  createFormDef,
  type UiTranslate,
} from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { provideAsLocale } from "../composables/use-as-locale";
import { objectType, stringProp } from "./helpers";

beforeAll(() => installDynamicResolver());

const DE: Record<string, string> = {
  "Name (empty)": "Name (leer)",
  "Hello {name}": "Hallo {name}",
  "Not x": "Nicht x",
};
const de: UiTranslate = (id, params) =>
  Object.hasOwn(DE, id) ? DE[id]!.replace("{name}", String(params?.name)) : undefined;

const Form = objectType({
  name: stringProp({
    [UI_FORM_FN_LABEL]: "(v) => v ? v : 'Name (empty)'",
    [UI_FORM_FN_PLACEHOLDER]: "(v, data, ctx, entry, t) => t('Hello {name}', { name: 'Bob' })",
    [UI_FORM_VALIDATE]: ["(v) => v !== 'x' || 'Not x'"],
  }),
});

function mountUnder(locale: string, translate?: UiTranslate, name = "") {
  const formData = reactive({ value: { name } });
  const wrapper = mount(
    defineComponent({
      setup() {
        provideAsLocale(() => locale, translate);
        const def = createFormDef(Form);
        return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
      },
    }),
  );
  return { wrapper, formData };
}

describe("fn expressions in the app's language", () => {
  it("text results and `t` in the fn scope use the app's texts", async () => {
    const { wrapper } = mountUnder("de", de);
    await nextTick();
    expect(wrapper.text()).toContain("Name (leer)");
    expect(wrapper.find("input").attributes("placeholder")).toBe("Hallo Bob");
    wrapper.unmount();
  });

  it("@ui.form.validate messages are reported translated", async () => {
    const { wrapper } = mountUnder("de", de, "x");
    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(wrapper.text()).toContain("Nicht x");
    wrapper.unmount();
  });

  it("English without a translation", async () => {
    const { wrapper } = mountUnder("de");
    await nextTick();
    expect(wrapper.text()).toContain("Name (empty)");
    expect(wrapper.find("input").attributes("placeholder")).toBe("Hello Bob");
    wrapper.unmount();
  });
});
