import { serializeAnnotatedType, translateServed } from "@atscript/typescript/utils";
import { describe, expect, it } from "vite-plus/test";

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
