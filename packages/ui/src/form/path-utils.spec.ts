import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { detectUnionVariant } from "./path-utils";
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
      const variants = discriminatedVariants().reverse();
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
