import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { createFormData, detectUnionVariant } from "./path-utils";
import type { FormUnionVariant } from "./types";

function literal(value: string) {
  return defineAnnotatedType().designType("string").value(value).$type;
}

function stringProp() {
  return defineAnnotatedType().designType("string").$type;
}

function numberProp() {
  return defineAnnotatedType().designType("number").$type;
}

function variant(label: string, type: ReturnType<typeof stringProp>): FormUnionVariant {
  return { label, type };
}

describe("detectUnionVariant", () => {
  it("returns 0 immediately when there is a single variant", () => {
    const variants = [variant("only", stringProp())];
    expect(detectUnionVariant("anything", variants)).toBe(0);
    expect(detectUnionVariant(null, variants)).toBe(0);
  });

  describe("discriminator fast-path", () => {
    function discriminatedVariants() {
      const urlImage = defineAnnotatedType("object")
        .prop("kind", literal("url"))
        .prop("url", stringProp()).$type;
      const uploadImage = defineAnnotatedType("object")
        .prop("kind", literal("upload"))
        .prop("fileId", stringProp()).$type;
      const inlineImage = defineAnnotatedType("object")
        .prop("kind", literal("inline"))
        .prop("data", stringProp()).$type;
      return [
        variant("UrlImage", urlImage),
        variant("UploadImage", uploadImage),
        variant("InlineImage", inlineImage),
      ];
    }

    it("returns the variant matching the discriminator value", () => {
      const variants = discriminatedVariants();
      expect(detectUnionVariant({ kind: "url", url: "https://x" }, variants)).toBe(0);
      expect(detectUnionVariant({ kind: "upload", fileId: "abc" }, variants)).toBe(1);
      expect(detectUnionVariant({ kind: "inline", data: "xyz" }, variants)).toBe(2);
    });

    it("looks up by discriminator regardless of variant declaration order", () => {
      // Same union as above with the variants reordered — the discriminator
      // hash is computed against the new order, so lookups still resolve.
      const variants = discriminatedVariants().toReversed();
      expect(detectUnionVariant({ kind: "url", url: "https://x" }, variants)).toBe(2);
      expect(detectUnionVariant({ kind: "upload", fileId: "abc" }, variants)).toBe(1);
    });

    it("falls through to validator search when discriminator value is unknown", () => {
      const variants = discriminatedVariants();
      // `kind: 'unknown'` matches no indexMapping entry; the validator loop
      // also rejects every variant (literal mismatch) — fallback to 0.
      expect(detectUnionVariant({ kind: "unknown" }, variants)).toBe(0);
    });

    it("falls through when value is missing the discriminator field", () => {
      const variants = discriminatedVariants();
      expect(detectUnionVariant({ url: "https://x" }, variants)).toBe(0);
    });
  });

  describe("validator fallback (no discriminator)", () => {
    it("matches heterogeneous primitive variants by type", () => {
      const variants = [variant("String", stringProp()), variant("Number", numberProp())];
      expect(detectUnionVariant("hello", variants)).toBe(0);
      expect(detectUnionVariant(42, variants)).toBe(1);
    });

    it("matches structurally distinct objects by required-prop fingerprint", () => {
      const person = defineAnnotatedType("object")
        .prop("firstName", stringProp())
        .prop("lastName", stringProp()).$type;
      const company = defineAnnotatedType("object")
        .prop("companyName", stringProp())
        .prop("taxId", stringProp()).$type;
      const variants = [variant("Person", person), variant("Company", company)];
      expect(detectUnionVariant({ firstName: "Ada", lastName: "Lovelace" }, variants)).toBe(0);
      expect(detectUnionVariant({ companyName: "ACME", taxId: "1" }, variants)).toBe(1);
    });

    it("returns 0 when no variant validates", () => {
      const variants = [variant("String", stringProp()), variant("Number", numberProp())];
      // Boolean satisfies neither variant.
      expect(detectUnionVariant(true, variants)).toBe(0);
    });

    it("returns 0 when no variant validates undefined", () => {
      const variants = [variant("String", stringProp()), variant("Number", numberProp())];
      expect(detectUnionVariant(undefined, variants)).toBe(0);
    });
  });
});

describe("createFormData primitive-init fallback", () => {
  // atscript's `finalDefault` table handles string/number/boolean/null but
  // returns `undefined` for `decimal` (and any other primitive added later
  // without a structural default). `createFormData` is the "make this
  // value exist" boundary used by the optional-toggle, array-add,
  // tuple-pad, and union-pick flows — returning `undefined` there leaves
  // AsFieldShell stuck in the empty-state placeholder.
  it("returns '' for a bare decimal prop (the structural default in atscript is undefined)", () => {
    const prop = defineAnnotatedType().designType("decimal").$type;
    const result = createFormData(prop);
    expect(result.value).toBe("");
  });

  it("preserves atscript's existing finalDefault for handled primitive types", () => {
    expect(createFormData(defineAnnotatedType().designType("string").$type).value).toBe("");
    expect(createFormData(defineAnnotatedType().designType("number").$type).value).toBe(0);
    expect(createFormData(defineAnnotatedType().designType("boolean").$type).value).toBe(false);
  });

  it("resolver value wins over the fallback when @meta.default is set on a number", () => {
    // The fallback only fires when the resolver returns undefined — a
    // present default should always take precedence.
    const prop = defineAnnotatedType().designType("number").annotate("meta.default", "42").$type;
    const result = createFormData(prop);
    expect(result.value).toBe(42);
  });
});
