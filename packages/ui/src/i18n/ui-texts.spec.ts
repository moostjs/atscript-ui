import { afterEach, describe, expect, it, vi } from "vitest";
import { AS_UI_MESSAGES } from "../messages";
import { activateUiTexts, createUiTexts, getUiTexts, setUiLocale, type UiT } from "./ui-texts";

/** The active UI texts' `t`, read per call. */
const uiT: UiT = (id, params) => getUiTexts().t(id, params);

function texts(locale: string | undefined, translate?: Parameters<typeof setUiLocale>[1]) {
  let current = locale;
  const t = createUiTexts({ locale: () => current, translate: () => translate });
  return Object.assign(t, { setLocale: (l: string | undefined) => (current = l) });
}

afterEach(() => setUiLocale(undefined));

describe("UI texts — lookup order", () => {
  it("English from AS_UI_MESSAGES, filled in one pass; an unknown id is itself", () => {
    const { t } = texts(undefined);
    expect(t("UI_CANCEL")).toBe("Cancel");
    expect(t("UI_FORM_ADD", { item: "address" })).toBe("Add address");
    // a filled-in value is never filled again; a missing param stays a placeholder
    expect(t("UI_FORM_ADD", { item: "{item}" })).toBe("Add {item}");
    expect(t("UI_FORM_SWITCH_TYPE")).toBe("Switch type — current: {type}");
    expect(t("UI_FILTER_CHIP_IN", { field: "Status", values: ["a", "b"] })).toBe(
      "Status is one of a, b",
    );
    expect(t("Plain literal text")).toBe("Plain literal text");
    expect(t("constructor")).toBe("constructor");
  });

  it("served texts of the current locale win over English, codes and literal texts alike", () => {
    const de = texts("de");
    de.merge("de", { UI_FORM_ADD: "{item} hinzufügen", Active: "Aktiv", ignored: 3 });
    expect(de.t("UI_FORM_ADD", { item: "Adresse" })).toBe("Adresse hinzufügen");
    expect(de.t("Active")).toBe("Aktiv");
    expect(de.t("UI_CANCEL")).toBe("Cancel");
    expect(de.t("ignored")).toBe("ignored");
    de.setLocale("fr");
    expect(de.t("UI_FORM_ADD", { item: "x" })).toBe("Add x");
  });

  it("the app's translator comes first, its text final; undefined falls back", () => {
    const seen: unknown[] = [];
    const de = texts("de", (id, params, locale) => {
      seen.push([id, params, locale]);
      return id === "UI_CANCEL" ? "Abbrechen {x}" : undefined;
    });
    de.merge("de", { UI_SAVE: "Speichern" });
    expect(de.t("UI_CANCEL", { x: 1 })).toBe("Abbrechen {x}");
    expect(de.t("UI_SAVE")).toBe("Speichern");
    expect(de.t("UI_CLOSE")).toBe("Close");
    expect(seen[0]).toEqual(["UI_CANCEL", { x: 1 }, "de"]);
  });

  it("a throwing translator falls back (logged once)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { t } = texts("de", () => {
      throw new Error("boom");
    });
    expect(t("UI_CANCEL")).toBe("Cancel");
    expect(t("UI_SAVE")).toBe("Save");
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe("UI texts — served dicts per locale", () => {
  it("an answer for a previous locale merges into that locale, never the current one", () => {
    const app = texts("de");
    // request sent while the locale was "de"; the user switched to "fr" before it answered
    app.setLocale("fr");
    app.merge("de", { UI_CANCEL: "Abbrechen" });
    expect(app.t("UI_CANCEL")).toBe("Cancel");
    app.setLocale("de");
    expect(app.t("UI_CANCEL")).toBe("Abbrechen");
  });

  it("merges add to a locale's dict and replace the holder only on change", () => {
    const dicts = { value: {} as Record<string, Record<string, string>> };
    const app = createUiTexts({ locale: () => "de", dicts });
    app.merge("de", { UI_CANCEL: "Abbrechen" });
    const first = dicts.value;
    app.merge("de", { UI_SAVE: "Speichern" });
    expect(dicts.value).not.toBe(first);
    expect(app.t("UI_CANCEL")).toBe("Abbrechen");
    expect(app.t("UI_SAVE")).toBe("Speichern");
    const second = dicts.value;
    app.merge("de", { UI_SAVE: "Speichern" });
    app.merge("de", undefined);
    app.merge("de", "nope");
    expect(dicts.value).toBe(second);
  });

  it("no locale is its own dict", () => {
    const app = texts(undefined);
    app.merge(undefined, { UI_CANCEL: "Abbrechen" });
    expect(app.t("UI_CANCEL")).toBe("Abbrechen");
    app.setLocale("en");
    expect(app.t("UI_CANCEL")).toBe("Cancel");
  });
});

describe("UI texts — the global source", () => {
  it("setUiLocale sets the locale and translator uiT reads", () => {
    expect(uiT("UI_YES")).toBe("Yes");
    setUiLocale("de", (id, _p, locale) => (id === "UI_YES" && locale === "de" ? "Ja" : undefined));
    expect(uiT("UI_YES")).toBe("Ja");
    expect(getUiTexts().locale()).toBe("de");
    setUiLocale(undefined);
    expect(uiT("UI_YES")).toBe("Yes");
  });

  it("an activated source replaces the global one until undone", () => {
    const app = texts("de", (id) => (id === "UI_NO" ? "Nein" : undefined));
    const undo = activateUiTexts(app);
    expect(uiT("UI_NO")).toBe("Nein");
    expect(getUiTexts()).toBe(app);
    undo();
    expect(uiT("UI_NO")).toBe("No");
  });

  it("every catalog entry is a string", () => {
    for (const [code, text] of Object.entries(AS_UI_MESSAGES)) {
      expect(code).toMatch(/^UI_[A-Z0-9_]+$/);
      expect(typeof text).toBe("string");
    }
    expect(Object.isFrozen(AS_UI_MESSAGES)).toBe(true);
  });
});

describe("UI texts — round 2", () => {
  it("a translator answering a missing key with the key itself counts as untranslated", () => {
    // i18next / vue-i18n return the key for a key they don't have
    const app = texts("de", (id) => (id === "UI_SAVE" ? "Speichern" : id));
    app.merge("de", { UI_CLOSE: "Schließen" });
    expect(app.t("UI_SAVE")).toBe("Speichern");
    expect(app.t("UI_CANCEL")).toBe("Cancel");
    expect(app.t("UI_CLOSE")).toBe("Schließen");
  });

  it("activations stack: undoing one gives the most recent remaining one back", () => {
    const a = texts("de", (id) => (id === "UI_YES" ? "Ja" : undefined));
    const b = texts("fr", (id) => (id === "UI_YES" ? "Oui" : undefined));
    const undoA = activateUiTexts(a);
    const undoB = activateUiTexts(b);
    expect(uiT("UI_YES")).toBe("Oui");
    undoB();
    expect(uiT("UI_YES")).toBe("Ja");
    undoB(); // idempotent
    expect(getUiTexts()).toBe(a);
    const undoB2 = activateUiTexts(b);
    undoA(); // out of order
    expect(uiT("UI_YES")).toBe("Oui");
    undoB2();
    expect(uiT("UI_YES")).toBe("Yes");
  });
});
