// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSSRApp, defineComponent, h, type Component } from "vue";
import { renderToString } from "vue/server-renderer";
import { getUiTexts, type UiTranslate } from "@atscript/ui";
import { createFormDef, createFormData } from "@atscript/ui";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { provideAsLocale } from "../composables/use-as-locale";
import { arrayType, objectType, stringProp } from "./helpers";

/**
 * A server renders many apps (users) at once: each app's locale and texts stay
 * its own, and nothing an app provides leaks into module-global state.
 */
const ItemsForm = objectType({ items: arrayType(stringProp()) });

function render(locale: string, translate?: UiTranslate): Promise<string> {
  const app = createSSRApp(
    defineComponent({
      setup() {
        provideAsLocale(() => locale, translate);
        const def = createFormDef(ItemsForm);
        const formData = createFormData(ItemsForm);
        return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
      },
    }),
  );
  return renderToString(app);
}

describe("provideAsLocale on a server", () => {
  it("concurrent renders keep their own texts; module-global texts stay untouched", async () => {
    const global = getUiTexts();
    const [de, fr, en] = await Promise.all([
      render("de", (id) => (id === "UI_FORM_SUBMIT" ? "Absenden" : undefined)),
      render("fr", (id) => (id === "UI_FORM_SUBMIT" ? "Envoyer" : undefined)),
      render("en"),
    ]);
    expect(de).toContain(">Absenden<");
    expect(fr).toContain(">Envoyer<");
    expect(en).toContain(">Submit<");
    expect(getUiTexts()).toBe(global);
    expect(getUiTexts().t("UI_FORM_SUBMIT")).toBe("Submit");
  });
});

describe("definition texts on a server", () => {
  const GERMAN: Record<string, string> = {
    UI_YES: "Ja",
    UI_FORM_TYPE_STRING: "Zeichenkette",
    UI_FORM_HIDDEN_PLACEHOLDER: "(verborgen)",
  };
  const de: UiTranslate = (id) => GERMAN[id];

  it("read-only booleans, union variant names and placeholders use the app's texts", async () => {
    const { defineAnnotatedType } = await import("@atscript/typescript/utils");
    const flag = defineAnnotatedType().designType("boolean");
    flag.annotate("meta.readonly" as never, true as never);
    const secret = defineAnnotatedType().designType("string");
    secret.annotate("db.writeOnly" as never, true as never);
    const union = defineAnnotatedType("union")
      .item(defineAnnotatedType().designType("string").$type)
      .item(defineAnnotatedType().designType("number").$type).$type;
    const type = objectType({ flag: flag.$type, secret: secret.$type, value: union });
    const app = createSSRApp(
      defineComponent({
        setup() {
          provideAsLocale(() => "de", de);
          const def = createFormDef(type);
          const formData = { value: { flag: true, value: "x" } };
          return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
        },
      }),
    );
    const html = await renderToString(app);
    expect(html).toContain(">Ja<");
    expect(html).toContain("Switch type — current: Zeichenkette");
    expect(html).toContain('placeholder="(verborgen)"');
    expect(html).not.toMatch(/>Yes<|current: String|\(hidden/);
  });
});

const modelDe: UiTranslate = (id) =>
  ({
    Order: "Bestellung",
    Name: "Name (de)",
    "Place order": "Bestellen",
    "By card": "Mit Karte",
  })[id];
const modelFr: UiTranslate = (id) => ({ Order: "Commande", Name: "Nom" })[id];

describe("model texts on a server", () => {
  async function renderOrder(translate: UiTranslate | undefined): Promise<string> {
    const { MtOrder } = await import("./fixtures/model-texts.as");
    const type = MtOrder as unknown as import("@atscript/typescript/utils").TAtscriptAnnotatedType;
    const app = createSSRApp(
      defineComponent({
        setup() {
          provideAsLocale(() => "de", translate);
          const def = createFormDef(type);
          const formData = { value: { pay: { number: "1" } } };
          return () => h(AsForm as Component, { def, formData, types: createDefaultTypes() });
        },
      }),
    );
    return renderToString(app);
  }

  it("a type compiled into the app renders translated by that app's own translator", async () => {
    const [german, french, plain] = await Promise.all([
      renderOrder(modelDe),
      renderOrder(modelFr),
      renderOrder(undefined),
    ]);
    expect(german).toContain("Name (de)");
    expect(german).toContain(">Bestellen<");
    expect(german).toContain("Mit Karte");
    expect(french).toContain("Commande");
    expect(french).not.toContain("Name (de)");
    expect(plain).toContain(">Place order<");
    expect(plain).not.toContain("Bestellung");
  });
});
