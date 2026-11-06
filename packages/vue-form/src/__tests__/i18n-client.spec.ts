import {
  createFormDef,
  resetDefaultClientFactory,
  resetValueHelpCache,
  setDefaultClientFactory,
  type ClientFactory,
  type UiTexts,
  type UiTranslate,
  type ValueHelpInfo,
} from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive, type Component } from "vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { provideAsLocale, useAsTexts } from "../composables/use-as-locale";
import { useAsValueHelp } from "../composables/use-as-value-help";
import { objectType, stringProp } from "./helpers";

const Signup = objectType({
  login: stringProp({
    "normalize.trim": true,
    "normalize.lowercase": true,
    "expect.minLength": { length: 3 },
  }),
});

function mountSignup(login: string, locale?: string, translate?: UiTranslate) {
  const formData = reactive({ value: { login } });
  const onSubmit = vi.fn();
  const onError = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        if (locale) provideAsLocale(() => locale, translate);
        const def = createFormDef(Signup);
        return () =>
          h(AsForm as Component, {
            def,
            formData,
            types: createDefaultTypes(),
            onSubmit,
            onError,
          });
      },
    }),
  );
  return { wrapper, formData, onSubmit, onError };
}

describe("submit applies @normalize.*", () => {
  it("validates and emits the normalized data; the form keeps what was typed", async () => {
    const { wrapper, formData, onSubmit, onError } = mountSignup("  Ann.Lee ");
    await wrapper.find("form").trigger("submit");
    expect(onError).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith({ login: "ann.lee" });
    expect(formData.value.login).toBe("  Ann.Lee ");
    wrapper.unmount();
  });

  it("judges the normalized value: a value only long enough with its spaces fails", async () => {
    const { wrapper, onSubmit, onError } = mountSignup(" ab ");
    await wrapper.find("form").trigger("submit");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith([
      { path: "login", message: "Expected minimum length of 3 characters, got 2 characters" },
    ]);
    wrapper.unmount();
  });
});

const de: UiTranslate = (id, params) =>
  id === "MIN_LENGTH" ? `Mindestens ${String(params?.min)} Zeichen` : undefined;

describe("client validation messages in the app's language", () => {
  it("submit errors and the field's message are worded by code", async () => {
    const { wrapper, onError } = mountSignup("ab", "de", de);
    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(onError).toHaveBeenCalledWith([{ path: "login", message: "Mindestens 3 Zeichen" }]);
    expect(wrapper.text()).toContain("Mindestens 3 Zeichen");
    wrapper.unmount();
  });
});

describe("value help in the app's locale", () => {
  afterEach(() => {
    resetValueHelpCache();
    resetDefaultClientFactory();
  });

  function authorsMeta() {
    const author = defineAnnotatedType("object");
    author.prop("id", defineAnnotatedType().designType("number").annotate("meta.id", true).$type);
    author.prop(
      "name",
      defineAnnotatedType().designType("string").annotate("ui.dict.label", true).$type,
    );
    return {
      searchable: true,
      vectorSearchable: false,
      searchIndexes: [],
      primaryKeys: ["id"],
      preferredId: ["id"],
      crud: { query: [], pages: [], one: [] },
      actions: [],
      relations: [],
      fields: { id: { sortable: true, filterable: true } },
      type: { ...serializeAnnotatedType(author.$type), $i18n: { UI_CANCEL: "Abbrechen" } },
    };
  }

  it("asks /meta in the app's locale and merges what it serves into the app's texts", async () => {
    const calls: unknown[][] = [];
    const meta = authorsMeta();
    const factory: ClientFactory = (...args) => {
      calls.push(args);
      return { meta: async () => meta, query: async () => [], invalidateMeta: vi.fn() } as never;
    };
    setDefaultClientFactory(factory);
    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    let texts!: UiTexts;
    let vh!: ReturnType<typeof useAsValueHelp>;
    const Picker = defineComponent({
      setup() {
        texts = useAsTexts();
        vh = useAsValueHelp({ info, model: { value: undefined }, onBlur: () => {} });
        return () => h("div");
      },
    });
    const wrapper = mount(
      defineComponent({
        setup() {
          provideAsLocale(() => "de");
          return () => h(Picker);
        },
      }),
    );
    await vh.kickoff();
    await new Promise((resolve) => setTimeout(resolve));
    expect(calls).toEqual([["/authors", { locale: "de" }]]);
    expect(texts.t("UI_CANCEL")).toBe("Abbrechen");
    wrapper.unmount();
  });
});
