import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "../form/create-form-def";
import { isUnionField } from "../form/types";
import { extractFieldLiteralOptions } from "../value-help/extract-literals";
import { resolveOptions } from "../value-help/resolve-options";
import type { UiT } from "./ui-texts";

/**
 * Definitions are built once for every locale (and on a server): what they
 * word comes from the caller's `t`, never from module-global texts.
 */
const de: UiT = (id) => ({ UI_YES: "Ja", UI_NO: "Nein" })[id] ?? id;
const flag = () => defineAnnotatedType().designType("boolean").$type;

describe("texts in definitions", () => {
  it("boolean option labels follow the caller's t", () => {
    expect(extractFieldLiteralOptions(flag(), de)?.map((o) => o.label)).toEqual(["Ja", "Nein"]);
    expect(resolveOptions(flag(), {}, undefined, de)).toEqual([
      { key: "true", label: "Ja", value: true },
      { key: "false", label: "Nein", value: false },
    ]);
    expect(extractFieldLiteralOptions(flag())?.map((o) => o.label)).toEqual(["Yes", "No"]);
  });

  it("generated union variant names keep their code (worded at render time)", () => {
    const union = defineAnnotatedType("union")
      .item(defineAnnotatedType().designType("string").$type)
      .item(defineAnnotatedType().designType("number").$type).$type;
    const def = createFormDef(defineAnnotatedType("object").prop("v", union).$type);
    const field = def.fields[0]!;
    expect(isUnionField(field)).toBe(true);
    if (!isUnionField(field)) return;
    expect(field.unionVariants.map((v) => [v.label, v.labelCode])).toEqual([
      ["1. String", "UI_FORM_TYPE_STRING"],
      ["2. Number", "UI_FORM_TYPE_NUMBER"],
    ]);
  });
});
