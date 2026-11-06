import { userTextAnnotations } from "@atscript/core";
import {
  deserializeAnnotatedType,
  serializeAnnotatedType,
  translateServed,
  type TAtscriptAnnotatedType,
} from "@atscript/typescript/utils";
import { createUiTexts } from "@atscript/ui";
import { describe, expect, it } from "vite-plus/test";

import { uiFnsAnnotations } from "../plugin/annotations";
import { DynamicFieldResolver } from "../runtime/dynamic-resolver";
import { ServedTexts } from "./fixtures/served-texts.as.js";

const de: Record<string, string> = {
  Order: "Bestellung",
  "Place order": "Bestellen",
  "Edit order": "Bestellung bearbeiten",
  "New order": "Neue Bestellung",
  Sales: "Vertrieb",
  Name: "Name",
  "Your name": "Ihr Name",
  "As on your passport": "Wie im Reisepass",
  "Name (set)": "Name (gesetzt)",
  "Not x": "Nicht x",
  "is-set": "ist-gesetzt",
  Red: "Rot",
  "Dark blue": "Dunkelblau",
  Open: "Offen",
  EUR: "€",
  "per month": "pro Monat",
  "phone number": "Telefonnummer",
  "Add phone": "Telefon hinzufügen",
  "Remove phone": "Telefon entfernen",
  "Resend code": "Code erneut senden",
  "Code sent to {recipient}.": "Code an {recipient} gesendet.",
};

function served() {
  return translateServed(serializeAnnotatedType(ServedTexts), (text) => de[text]) as {
    value: { metadata: Record<string, unknown>; type: { props: Record<string, any> } };
    texts: Record<string, string>;
  };
}

describe("@ui.* texts in a served type", () => {
  it("translates the static texts of the ui annotations", () => {
    const { value } = served();
    expect(value.metadata["ui.form.submit.text"]).toBe("Bestellen");
    expect(value.metadata["ui.nav.group"]).toBe("Vertrieb");
    const p = value.type.props;
    expect(p.name.metadata["ui.form.placeholder"]).toBe("Ihr Name");
    expect(p.name.metadata["ui.form.hint"]).toBe("Wie im Reisepass");
    expect(p.status.metadata["ui.literalLabel"]).toEqual([{ value: "open", label: "Offen" }]);
    expect(p.price.metadata["ui.form.prefix"]).toBe("€");
    expect(p.price.metadata["ui.form.suffix"]).toBe("pro Monat");
    expect(p.phones.metadata["ui.form.label.singular"]).toBe("Telefonnummer");
    expect(p.phones.metadata["ui.array.add.label"]).toBe("Telefon hinzufügen");
    expect(p.phones.metadata["ui.array.remove.label"]).toBe("Telefon entfernen");
    expect(p.resend.metadata["ui.form.action"]).toEqual({
      id: "resend",
      label: "Code erneut senden",
    });
  });

  it("translates option labels and keeps their values in the source language", () => {
    const { value } = served();
    // An option without a value keeps its source label as the value: the value
    // a form submits never depends on the language.
    expect(value.type.props.color.metadata["ui.form.options"]).toEqual([
      { label: "Rot", value: "Red" },
      { label: "Dunkelblau", value: "blue" },
    ]);
  });

  it("keeps expressions as they are and serves the translated literals of text expressions", () => {
    const { value, texts } = served();
    expect(value.metadata["ui.form.fn.title"]).toBe(
      '(data) => data.id ? "Edit order" : "New order"',
    );
    expect(texts).toMatchObject({
      "Edit order": "Bestellung bearbeiten",
      "New order": "Neue Bestellung",
      "Name (set)": "Name (gesetzt)",
      "Not x": "Nicht x",
    });
    // A class name is no user text: `@ui.form.fn.classes` is not extracted.
    expect(texts).not.toHaveProperty("is-set");
  });
});

describe("@ui.form.fn.value on a display-only field", () => {
  it("serves the translated literals of its expression, and only translated ones", () => {
    const { value, texts } = served();
    expect(value.type.props.sent.metadata["ui.form.fn.value"]).toContain(
      't("Code sent to {recipient}."',
    );
    expect(texts["Code sent to {recipient}."]).toBe("Code an {recipient} gesendet.");
    // A literal the translator has no text for adds nothing to what is served.
    expect(texts).not.toHaveProperty("Request a code");
  });

  it("shows `t(…)` in the served language, params filled", () => {
    const { value, texts } = served();
    const appTexts = createUiTexts({ locale: () => "de" });
    appTexts.merge("de", texts);
    // A phantom field is no key of the interface: read it from the served type.
    const props = deserializeAnnotatedType(value as never).type as unknown as {
      props: Map<string, TAtscriptAnnotatedType>;
    };
    const resolver = new DynamicFieldResolver();
    const show = (context: Record<string, unknown>) =>
      resolver.resolveFieldProp(props.props.get("sent")!, "ui.form.fn.value", undefined, {
        v: undefined,
        data: {},
        context,
        entry: undefined,
        t: appTexts.t,
      });
    expect(show({ recipient: "a@b.c" })).toBe("Code an a@b.c gesendet.");
    // Not through `t`: the value as the fn returns it.
    expect(show({})).toBe("Request a code");
  });
});

describe("which fn annotations hold user text", () => {
  it("every fn whose result users see — never the logic and styling fns", () => {
    // Not here: fn.disabled / hidden / readonly / submit.disabled (booleans),
    // fn.classes / styles and their table twins (CSS).
    expect(Object.fromEntries(userTextAnnotations(uiFnsAnnotations))).toEqual({
      "ui.form.validate": "expression",
      "ui.form.fn.title": "expression",
      "ui.form.fn.submit.text": "expression",
      "ui.form.fn.label": "expression",
      "ui.form.fn.description": "expression",
      "ui.form.fn.hint": "expression",
      "ui.form.fn.placeholder": "expression",
      "ui.form.fn.value": "expression",
      "ui.form.fn.options": "expression",
      "ui.form.fn.attr": ["fn()"],
      "ui.table.fn.attr": ["fn()"],
    });
  });
});
