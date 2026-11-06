import { describe, expect, it } from "vitest";
import { defineAnnotatedType, type TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "./create-form-def";
import { createFieldValidator, getFormValidator } from "./validate";
import { activateUiTexts, createUiTexts } from "../i18n/ui-texts";

function stringProp(meta: Record<string, unknown>): TAtscriptAnnotatedType {
  const h = defineAnnotatedType().designType("string");
  for (const [key, value] of Object.entries(meta)) h.annotate(key as never, value as never);
  return h.$type;
}

const Signup = defineAnnotatedType("object")
  .prop(
    "login",
    stringProp({
      "normalize.trim": true,
      "normalize.lowercase": true,
      "expect.minLength": { length: 3 },
    }),
  )
  .prop("name", stringProp({ "expect.minLength": { length: 2 } })).$type;

/** UI texts in German with what `/meta` serves for it merged in. */
function germanTexts() {
  const texts = createUiTexts({ locale: () => "de" });
  texts.merge("de", { MIN_LENGTH: "Mindestens {min} Zeichen (statt {actual})" });
  return texts;
}

describe("client validation messages in the app's language", () => {
  it("form validator words errors by code with the served templates", () => {
    const validate = getFormValidator(createFormDef(Signup));
    const { t } = germanTexts();
    expect(validate({ data: { login: "abc", name: "A" }, t })).toEqual({
      name: "Mindestens 2 Zeichen (statt 1)",
    });
  });

  it("field validator words its error by code with the served templates", () => {
    const prop = createFormDef(Signup).flatMap.get("name")!;
    const { t } = germanTexts();
    expect(createFieldValidator(prop)("A", { data: {}, context: {}, t })).toBe(
      "Mindestens 2 Zeichen (statt 1)",
    );
    expect(createFieldValidator(prop, { t })("A")).toBe("Mindestens 2 Zeichen (statt 1)");
  });

  it("defaults to the active UI texts; English without a template", () => {
    const validate = getFormValidator(createFormDef(Signup));
    const undo = activateUiTexts(germanTexts());
    try {
      expect(validate({ data: { login: "abc", name: "A" } }).name).toBe(
        "Mindestens 2 Zeichen (statt 1)",
      );
    } finally {
      undo();
    }
    expect(validate({ data: { login: "abc", name: "A" } }).name).toBe(
      "Expected minimum length of 2 characters, got 1 characters",
    );
  });

  it("the app's translator words errors by code (params passed)", () => {
    const texts = createUiTexts({
      locale: () => "fr",
      translate: () => (id, params) =>
        id === "MIN_LENGTH" ? `Au moins ${String(params?.min)} caractères` : undefined,
    });
    const validate = getFormValidator(createFormDef(Signup));
    expect(validate({ data: { login: "abc", name: "A" }, t: texts.t }).name).toBe(
      "Au moins 2 caractères",
    );
  });
});

describe("@normalize.* before client validation", () => {
  it("normalize() applies the type's normalizers, copy-on-change", () => {
    const validator = getFormValidator(createFormDef(Signup));
    const typed = { login: "  Ann  ", name: " Bo " };
    expect(validator.normalize(typed)).toEqual({ login: "ann", name: " Bo " });
    expect(typed.login).toBe("  Ann  ");
    const clean = { login: "ann", name: "Bo" };
    expect(validator.normalize(clean)).toBe(clean);
  });

  it("a field is judged on its normalized value", () => {
    const prop = createFormDef(Signup).flatMap.get("login")!;
    const validate = createFieldValidator(prop);
    // three characters typed, two after trimming: the server would refuse it
    expect(validate("ab ")).toMatch(/minimum length of 3/);
    expect(validate("  Abc  ")).toBe(true);
  });
});
