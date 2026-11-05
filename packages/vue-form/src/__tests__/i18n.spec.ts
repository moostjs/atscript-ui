import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Component } from "vue";
import { mount } from "@vue/test-utils";
import { getUiTexts, setUiLocale, type UiTranslate } from "@atscript/ui";
import { createFormDef, createFormData } from "@atscript/ui";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { provideAsLocale, useAsLocale, useAsTexts } from "../composables/use-as-locale";
import { arrayType, objectType, stringProp } from "./helpers";

const de: UiTranslate = (id, params) =>
  id === "UI_FORM_ADD" ? `${String(params?.item)} hinzufügen` : undefined;

const ItemsForm = objectType({ items: arrayType(stringProp()) });

/** An `<AsForm>` under `provideAsLocale(locale, translate)`. */
function formUnder(locale: () => string | undefined, translate?: UiTranslate): Component {
  return defineComponent({
    setup() {
      provideAsLocale(locale, translate);
      const def = createFormDef(ItemsForm);
      const formData = createFormData(ItemsForm);
      return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
    },
  });
}

/** Captures the app's texts from inside the provider. */
function probeUnder(locale: () => string | undefined, translate?: UiTranslate) {
  let texts!: ReturnType<typeof useAsTexts>;
  let api!: ReturnType<typeof useAsLocale>;
  const Probe = defineComponent({
    setup() {
      texts = useAsTexts();
      api = useAsLocale();
      return () => h("span", api.t("UI_FORM_SUBMIT"));
    },
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        provideAsLocale(locale, translate);
        return () => h(Probe);
      },
    }),
  );
  return { wrapper, texts: () => texts, api: () => api };
}

afterEach(() => setUiLocale(undefined));

describe("provideAsLocale — the app's UI texts", () => {
  it("the app's translator words the components; English where it has nothing", () => {
    const wrapper = mount(formUnder(() => "de", de));
    expect(wrapper.find(".as-array-add-btn").text()).toBe("item hinzufügen");
    expect(wrapper.find(".as-submit-btn").text()).toBe("Submit");
    wrapper.unmount();
  });

  it("served texts merged for the current locale re-render the components", async () => {
    const lang = ref("de");
    const { wrapper, texts, api } = probeUnder(() => lang.value);
    expect(wrapper.text()).toBe("Submit");
    texts().merge("de", { UI_FORM_SUBMIT: "Absenden" });
    await nextTick();
    expect(wrapper.text()).toBe("Absenden");
    lang.value = "fr";
    await nextTick();
    expect(wrapper.text()).toBe("Submit");
    expect(api().locale.value).toBe("fr");
    wrapper.unmount();
  });

  it("two apps keep their own locale, translator and served texts", () => {
    const a = probeUnder(
      () => "de",
      (id) => (id === "UI_CANCEL" ? "Abbrechen" : undefined),
    );
    const b = probeUnder(() => "fr");
    a.texts().merge("de", { UI_FORM_SUBMIT: "Absenden" });
    b.texts().merge("de", { UI_FORM_SUBMIT: "nope" });
    expect(a.api().t("UI_FORM_SUBMIT")).toBe("Absenden");
    expect(a.api().t("UI_CANCEL")).toBe("Abbrechen");
    expect(b.api().t("UI_FORM_SUBMIT")).toBe("Submit");
    expect(b.api().t("UI_CANCEL")).toBe("Cancel");
    a.wrapper.unmount();
    b.wrapper.unmount();
  });

  it("without a provider, components read the global texts (setUiLocale)", () => {
    setUiLocale("de", de);
    const wrapper = mount(AsForm as Component, {
      props: {
        def: createFormDef(ItemsForm),
        formData: createFormData(ItemsForm),
        types: createDefaultTypes(),
      },
    });
    expect(wrapper.find(".as-array-add-btn").text()).toBe("item hinzufügen");
    wrapper.unmount();
  });

  it("in a browser the provider's texts also serve code outside components, until unmounted", () => {
    const { wrapper, texts } = probeUnder(() => "de", de);
    expect(getUiTexts()).toBe(texts());
    expect(getUiTexts().t("UI_FORM_ADD", { item: "x" })).toBe("x hinzufügen");
    wrapper.unmount();
    expect(getUiTexts().t("UI_FORM_ADD", { item: "x" })).toBe("Add x");
  });

  it("useAsLocale().locale stays undefined without a provider", () => {
    setUiLocale("de");
    let api!: ReturnType<typeof useAsLocale>;
    const app = createApp(
      defineComponent({
        setup() {
          api = useAsLocale();
          return () => h("div");
        },
      }),
    );
    app.mount(document.createElement("div"));
    expect(api.locale.value).toBeUndefined();
    app.unmount();
  });
});
