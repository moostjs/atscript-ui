import { deserializeAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { createFormDef } from "../form/create-form-def";
import { isUnionField } from "../form/types";
import { resolveSingularLabel } from "../form/labels";
import { buildModelRoutes } from "../nav/model-routes";
import {
  META_LABEL,
  UI_FORM_HINT,
  UI_FORM_OPTIONS,
  UI_FORM_PLACEHOLDER,
  UI_FORM_SUBMIT_TEXT,
} from "../shared/annotation-keys";
import { resolveFieldProp, resolveFormProp, resolveStatic } from "../shared/field-resolver";
import { extractFieldLiteralOptions } from "../value-help/extract-literals";
import { parseStaticOptions, resolveOptions } from "../value-help/resolve-options";
import {
  deserializeServedType,
  fieldText,
  isServedType,
  markServedType,
  userText,
} from "./model-texts";

const dict: Record<string, string> = {
  Order: "Bestellung",
  Name: "Name (de)",
  "Full legal name": "Vollständiger Name",
  "Your name": "Ihr Name",
  "Place order": "Bestellen",
  Sales: "Vertrieb",
  Red: "Rot",
  "Dark blue": "Dunkelblau",
  Open: "Offen",
  EUR: "€",
  "per month": "pro Monat",
  "phone number": "Telefonnummer",
  "Card number": "Kartennummer",
};
const de = (text: string) => dict[text];

async function load() {
  const { TxOrder } = await import("../__tests__/fixtures/model-texts.as");
  return TxOrder as unknown as TAtscriptAnnotatedType<TAtscriptTypeObject>;
}

const prop = (type: TAtscriptAnnotatedType<TAtscriptTypeObject>, name: string) =>
  type.type.props.get(name)!;

describe("userText / fieldText", () => {
  it("translates a text key by the server's rules, any other key stays", async () => {
    const order = await load();
    expect(fieldText(order, META_LABEL, de)).toBe("Bestellung");
    expect(fieldText(prop(order, "name"), UI_FORM_HINT, de)).toBe("Vollständiger Name");
    expect(fieldText(prop(order, "name"), META_LABEL)).toBe("Name");
    expect(userText("db.table", "orders", de)).toBe("orders");
    // an untranslated text (and a translator that returns nothing) is kept as it is
    expect(fieldText(prop(order, "name"), UI_FORM_PLACEHOLDER, () => undefined)).toBe("Your name");
  });

  it("translates the labels of a list and keeps the shared type untouched", async () => {
    const order = await load();
    const raw = prop(order, "color").metadata.get(UI_FORM_OPTIONS);
    const before = JSON.stringify(raw);
    const out = userText(UI_FORM_OPTIONS, raw, de) as { label: string; value: string }[];
    expect(out).toEqual([
      { label: "Rot", value: "Red" },
      { label: "Dunkelblau", value: "blue" },
    ]);
    expect(JSON.stringify(raw)).toBe(before);
    expect(userText(UI_FORM_OPTIONS, raw, () => undefined)).toBe(raw);
  });
});

describe("resolveStatic / resolveFieldProp with t", () => {
  it("translates a static text before it is transformed", async () => {
    const order = await load();
    const name = prop(order, "name");
    expect(resolveStatic(name.metadata, UI_FORM_PLACEHOLDER, { t: de })).toBe("Ihr Name");
    expect(resolveStatic(name.metadata, UI_FORM_PLACEHOLDER)).toBe("Your name");
    expect(
      resolveStatic<string>(name.metadata, UI_FORM_PLACEHOLDER, {
        t: de,
        transform: (raw) => `<${String(raw)}>`,
      }),
    ).toBe("<Ihr Name>");
    // a flag is a presence, not a text
    expect(
      resolveStatic(name.metadata, UI_FORM_PLACEHOLDER, { t: de, staticAsBoolean: true }),
    ).toBe(true);
  });

  it("the resolvers pass t through", async () => {
    const order = await load();
    expect(resolveFieldProp<string>(prop(order, "name"), "", UI_FORM_HINT, {}, { t: de })).toBe(
      "Vollständiger Name",
    );
    expect(resolveFormProp<string>(order, "", UI_FORM_SUBMIT_TEXT, {}, { t: de })).toBe(
      "Bestellen",
    );
  });
});

describe("options with text", () => {
  it("parseStaticOptions translates labels, never keys", () => {
    expect(
      parseStaticOptions([{ label: "Red" }, { label: "Dark blue", value: "blue" }, "x"], de),
    ).toEqual([{ key: "Red", label: "Rot" }, { key: "blue", label: "Dunkelblau" }, "x"]);
    expect(parseStaticOptions([{ label: "Red" }, { label: "Dark blue", value: "blue" }])).toEqual([
      "Red",
      { key: "blue", label: "Dark blue" },
    ]);
    expect(parseStaticOptions([{ label: "Nope" }], de)).toEqual(["Nope"]);
  });

  it("resolveOptions translates @ui.form.options and @ui.literalLabel labels", async () => {
    const order = await load();
    expect(resolveOptions(prop(order, "color"), {}, undefined, undefined, de)).toEqual([
      { key: "Red", label: "Rot" },
      { key: "blue", label: "Dunkelblau" },
    ]);
    const status = resolveOptions(prop(order, "status"), {}, undefined, undefined, de);
    expect(
      status?.map((o) => [(o as { key: string }).key, (o as { label: string }).label]),
    ).toEqual([
      ["open", "Offen"],
      ["closed", "closed"],
    ]);
    expect(extractFieldLiteralOptions(prop(order, "status"))?.[0]?.label).toBe("Open");
  });

  it("resolveSingularLabel translates @ui.form.label.singular", async () => {
    const order = await load();
    expect(resolveSingularLabel(prop(order, "phones"), undefined, de)).toBe("Telefonnummer");
    expect(resolveSingularLabel(prop(order, "phones"))).toBe("phone number");
  });
});

describe("buildModelRoutes with t", () => {
  it("translates the label and the group of a compiled model", async () => {
    const order = await load();
    const [route] = buildModelRoutes([order], { t: de });
    expect([route!.label, route!.group]).toEqual(["Bestellung", "Vertrieb"]);
    const [plain] = buildModelRoutes([order]);
    expect([plain!.label, plain!.group]).toEqual(["Order", "Sales"]);
  });

  it("leaves a served model as it is", async () => {
    const order = await load();
    const served = markServedType(deserializeAnnotatedType(serializeAnnotatedType(order)));
    const [route] = buildModelRoutes([served], { t: de });
    expect([route!.label, route!.group]).toEqual(["Order", "Sales"]);
  });
});

describe("served types", () => {
  it("marks a deserialized schema that carries $i18n, and createFormDef copies the mark", async () => {
    const order = await load();
    const json = serializeAnnotatedType(order);
    const unserved = deserializeServedType(json);
    expect(isServedType(unserved)).toBe(false);
    expect(createFormDef(unserved).served).toBeUndefined();

    const served = deserializeServedType({ ...json, $i18n: {} } as typeof json);
    expect(isServedType(served)).toBe(true);
    expect(createFormDef(served).served).toBe(true);
    // the compiled type itself is never marked
    expect(isServedType(order)).toBe(false);
    expect(createFormDef(order).served).toBeUndefined();
  });
});

describe("union variants keep the source label", () => {
  it("the def keeps the label fixed and carries the @meta.label text to translate at render time", async () => {
    const order = await load();
    const field = createFormDef(order).fields.find((f) => f.name === "pay");
    expect(field && isUnionField(field)).toBe(true);
    if (!field || !isUnionField(field)) return;
    expect(field.unionVariants.map((v) => [v.label, v.labelText])).toEqual([
      ["1. Card number", "Card number"],
      ["2. IBAN", "IBAN"],
    ]);
  });
});
