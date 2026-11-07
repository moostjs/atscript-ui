import { beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, reactive, ref, type Component } from "vue";
import { mount } from "@vue/test-utils";
import { deserializeServedType, createFormDef, isServedType, type UiTranslate } from "@atscript/ui";
import { buildFieldEntry, installDynamicResolver } from "@atscript/ui-fns";
import {
  serializeAnnotatedType,
  translateServed,
  type TAtscriptAnnotatedType,
  type TSerializedAnnotatedType,
} from "@atscript/typescript/utils";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { provideAsLocale } from "../composables/use-as-locale";

beforeAll(() => installDynamicResolver());

const DICT: Record<string, Record<string, string>> = {
  de: {
    Order: "Bestellung",
    "An order of the shop": "Eine Bestellung im Shop",
    "Place order": "Bestellen",
    Name: "Name (de)",
    "As on your passport": "Wie im Reisepass",
    "Full legal name": "Vollständiger Name",
    "Your name": "Ihr Name",
    Colour: "Farbe",
    Red: "Rot",
    "Dark blue": "Dunkelblau",
    Status: "Zustand",
    Open: "Offen",
    Price: "Preis",
    EUR: "€",
    "per month": "pro Monat",
    Phones: "Telefone",
    "phone number": "Telefonnummer",
    Payment: "Zahlung",
    "By card": "Mit Karte",
    "By transfer": "Per Überweisung",
    // an expression result is translated once: Alpha -> Beta, not Gamma
    Alpha: "Beta",
    Beta: "Gamma",
    Nope: "Nein",
    // a validator message is translated once: Nope -> Nein, not Nein -> this
    Nein: "Zweimal übersetzt",
    Tag: "Kennung",
    "Too short": "Zu kurz",
    "Zu kurz": "Doppelt gekürzt",
    // a translated text that equals another source text must not be translated again
    "Name (de)": "Doppelt übersetzt",
  },
  fr: { Order: "Commande", Name: "Nom", "Place order": "Commander", "By card": "Par carte" },
};
const translator: UiTranslate = (id, _params, locale) => DICT[locale ?? ""]?.[id];

const loadOrder = async () =>
  (await import("./fixtures/model-texts.as")).MtOrder as unknown as TAtscriptAnnotatedType;

const DATA = {
  name: "",
  color: "",
  status: "open",
  price: 1,
  phones: ["1"],
  pay: { number: "1" },
  code: "",
  tag: "abcd",
};

function mountUnder(
  type: TAtscriptAnnotatedType,
  locale: () => string | undefined,
  translate: UiTranslate | null = translator,
  value: Record<string, unknown> = DATA,
) {
  const formData = reactive({ value: { ...value } });
  const wrapper = mount(
    defineComponent({
      setup() {
        provideAsLocale(locale, translate ?? undefined);
        const def = createFormDef(type);
        return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
      },
    }),
  );
  return { wrapper, formData };
}

async function openPicker(wrapper: ReturnType<typeof mount>) {
  await wrapper.find(".as-variant-trigger").trigger("click");
  await nextTick();
}

describe("a type compiled into the client, translated at render time", () => {
  it("translates label, description, hint, placeholder, prefix, suffix, options, title, submit and variants", async () => {
    const order = await loadOrder();
    const { wrapper } = mountUnder(order, () => "de");
    await nextTick();
    const text = wrapper.text();
    for (const shown of [
      "Bestellung", // title
      "Eine Bestellung im Shop", // root description
      "Name (de)", // label
      "Wie im Reisepass", // description
      "Farbe",
      "Zustand",
      "Preis",
      "Telefone",
      "Zahlung",
      "€", // prefix
      "pro Monat", // suffix
      "Telefonnummer", // singular label ("Add Telefonnummer")
      "Mit Karte", // union variant (picker trigger)
    ]) {
      expect(text).toContain(shown);
    }
    expect(wrapper.find(".as-submit-btn").text()).toBe("Bestellen");
    const inputs = wrapper.findAll("input");
    expect(inputs.some((i) => i.attributes("placeholder") === "Ihr Name")).toBe(true);
    // hint is shown while there is no error
    expect(text).toContain("Vollständiger Name");
    const options = wrapper.findAll("option").map((o) => o.text());
    expect(options).toEqual(expect.arrayContaining(["Rot", "Dunkelblau", "Offen", "closed"]));
    await openPicker(wrapper);
    expect(wrapper.findAll(".as-dropdown-item").map((i) => i.text())).toEqual(
      expect.arrayContaining([expect.stringContaining("Per Überweisung")]),
    );
    wrapper.unmount();
  });

  it("shows the source texts without a translator, and where it has no translation", async () => {
    const order = await loadOrder();
    const none = mountUnder(order, () => "de", null);
    await nextTick();
    expect(none.wrapper.text()).toContain("Name");
    expect(none.wrapper.text()).not.toContain("(de)");
    expect(none.wrapper.find(".as-submit-btn").text()).toBe("Place order");
    none.wrapper.unmount();
    // `fr` knows only a few texts: the rest stays English
    const fr = mountUnder(order, () => "fr");
    await nextTick();
    expect(fr.wrapper.text()).toContain("Nom");
    expect(fr.wrapper.text()).toContain("Colour");
    fr.wrapper.unmount();
  });

  it("re-renders on a locale switch, without a remount", async () => {
    const order = await loadOrder();
    const lang = ref("de");
    const { wrapper } = mountUnder(order, () => lang.value);
    await nextTick();
    const input = wrapper.find("input");
    expect(wrapper.find(".as-submit-btn").text()).toBe("Bestellen");
    expect(wrapper.text()).toContain("Mit Karte");
    lang.value = "fr";
    await nextTick();
    expect(wrapper.find(".as-submit-btn").text()).toBe("Commander");
    expect(wrapper.text()).toContain("Nom");
    expect(wrapper.text()).toContain("Par carte");
    expect(wrapper.text()).not.toContain("Mit Karte");
    expect(wrapper.find("input").element).toBe(input.element);
    wrapper.unmount();
  });

  it("never changes the shared compiled type", async () => {
    const order = await loadOrder();
    const before = JSON.stringify(serializeAnnotatedType(order));
    const { wrapper } = mountUnder(order, () => "de");
    await nextTick();
    await openPicker(wrapper);
    wrapper.unmount();
    expect(JSON.stringify(serializeAnnotatedType(order))).toBe(before);
  });

  it("translates an expression result and a validator message exactly once", async () => {
    const order = await loadOrder();
    const { wrapper } = mountUnder(order, () => "de", translator, { ...DATA, code: "x" });
    await nextTick();
    // `fn.label` -> "Alpha" -> "Beta" (not "Gamma"); a model text next to it is translated too
    expect(wrapper.text()).toContain("Beta");
    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(wrapper.find(".as-error-slot").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Gamma");
    expect(wrapper.findAll(".as-error-slot").map((e) => e.text())).toContain("Nein");
    wrapper.unmount();
  });
});

describe("option labels that expressions read (entry.options)", () => {
  it("carry the app's language, keys stay the source texts", async () => {
    const order = await loadOrder();
    const color = (
      order.type as unknown as { props: Map<string, TAtscriptAnnotatedType> }
    ).props.get("color")!;
    const entry = (modelT?: (text: string) => string | undefined) =>
      buildFieldEntry(color, { data: {}, context: {} }, "color", { modelT }).entry!.options;
    expect(entry((text) => DICT.de![text])).toEqual([
      { key: "Red", label: "Rot" },
      { key: "blue", label: "Dunkelblau" },
    ]);
    // a served type is translated already: the source labels
    expect(JSON.stringify(entry())).toContain("Dark blue");
  });
});

describe("a schema the server served", () => {
  /**
   * What a server with `translator`'s catalogue serves for `order`: translated, and marked with
   * `$i18n` whenever it translated (an empty one included — see `build` in moost-wf).
   */
  async function served(i18n?: Record<string, string>) {
    const order = await loadOrder();
    const json = serializeAnnotatedType(order);
    const { value, texts } = translateServed(json, (text) => DICT.de![text] ?? undefined);
    expect(value).not.toBe(json);
    const body = { ...value, $i18n: i18n ?? texts } as TSerializedAnnotatedType;
    return deserializeServedType(body);
  }

  it("is not translated again — a translated text equal to another source text stays", async () => {
    const type = await served({ UI_FORM_SUBMIT: "Senden" });
    // the server turned "Name" into "Name (de)", which the app's catalogue would translate again
    const { wrapper } = mountUnder(type, () => "de");
    await nextTick();
    expect(wrapper.text()).toContain("Name (de)");
    expect(wrapper.text()).not.toContain("Doppelt übersetzt");
    expect(wrapper.find(".as-submit-btn").text()).toBe("Bestellen");
    wrapper.unmount();
  });

  it("is served already with an empty $i18n: the mark is its presence", async () => {
    const type = await served({});
    expect(isServedType(type)).toBe(true);
    const { wrapper } = mountUnder(type, () => "de");
    await nextTick();
    expect(wrapper.text()).toContain("Name (de)");
    expect(wrapper.text()).not.toContain("Doppelt übersetzt");
    wrapper.unmount();
  });

  it("keeps a server-translated custom @expect message, but still words validator codes", async () => {
    const type = await served({});
    const { wrapper } = mountUnder(type, () => "de", translator, { ...DATA, tag: "a" });
    await nextTick();
    await wrapper.find("form").trigger("submit");
    await nextTick();
    const errors = wrapper.findAll(".as-error-slot").map((e) => e.text());
    // the server's "Zu kurz" is final: not looked up as a text id again
    expect(errors).toContain("Zu kurz");
    expect(errors).not.toContain("Doppelt gekürzt");
    wrapper.unmount();
    // the same message of a type compiled into the client is translated by the app, once
    const compiled = mountUnder(await loadOrder(), () => "de", translator, { ...DATA, tag: "a" });
    await nextTick();
    await compiled.wrapper.find("form").trigger("submit");
    await nextTick();
    expect(compiled.wrapper.findAll(".as-error-slot").map((e) => e.text())).toContain("Zu kurz");
    compiled.wrapper.unmount();
  });

  it("a schema without $i18n is untranslated source, which the app's catalogue translates", async () => {
    const order = await loadOrder();
    const type = deserializeServedType(serializeAnnotatedType(order));
    expect(isServedType(type)).toBe(false);
    const { wrapper } = mountUnder(type, () => "de");
    await nextTick();
    expect(wrapper.text()).toContain("Name (de)");
    wrapper.unmount();
  });
});
