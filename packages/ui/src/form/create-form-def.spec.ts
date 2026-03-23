import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { META_LABEL, UI_COMPONENT, UI_HIDDEN, UI_ORDER, UI_TYPE } from "../shared/annotation-keys";
import { createFormDef, buildUnionVariants } from "./create-form-def";
import { isArrayField, isObjectField, isTupleField, isUnionField } from "./types";
import type {
  FormArrayFieldDef,
  FormObjectFieldDef,
  FormTupleFieldDef,
  FormUnionFieldDef,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────

function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

function numberProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("number");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

function booleanProp() {
  return defineAnnotatedType().designType("boolean").$type;
}

function phantomProp() {
  return defineAnnotatedType().designType("phantom").$type;
}

function objectType(
  props: Record<string, ReturnType<typeof stringProp>>,
  meta?: Record<string, unknown>,
) {
  const h = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) h.prop(name, prop);
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

// ── Tests ────────────────────────────────────────────────────

describe("createFormDef", () => {
  describe("object types", () => {
    it("creates fields for a simple object with string/number/boolean props", () => {
      const type = objectType({
        name: stringProp(),
        age: numberProp(),
        active: booleanProp(),
      });
      const def = createFormDef(type);

      expect(def.fields).toHaveLength(3);
      expect(def.fields[0]!.path).toBe("name");
      expect(def.fields[0]!.type).toBe("text");
      expect(def.fields[1]!.path).toBe("age");
      expect(def.fields[1]!.type).toBe("number");
      expect(def.fields[2]!.path).toBe("active");
      expect(def.fields[2]!.type).toBe("checkbox");
    });

    it("sets rootField as an object field", () => {
      const type = objectType({ name: stringProp() });
      const def = createFormDef(type);

      expect(def.rootField.type).toBe("object");
      expect(def.rootField.path).toBe("");
      expect(isObjectField(def.rootField)).toBe(true);
      expect((def.rootField as FormObjectFieldDef).objectDef).toBe(def);
    });

    it("populates flatMap with all field paths", () => {
      const type = objectType({
        name: stringProp(),
        email: stringProp(),
      });
      const def = createFormDef(type);

      expect(def.flatMap.size).toBeGreaterThanOrEqual(2);
      expect(def.flatMap.has("name")).toBe(true);
      expect(def.flatMap.has("email")).toBe(true);
    });

    it("sorts fields by @ui.order", () => {
      const type = objectType({
        email: stringProp({ [UI_ORDER]: 2 }),
        name: stringProp({ [UI_ORDER]: 1 }),
        bio: stringProp({ [UI_ORDER]: 3 }),
      });
      const def = createFormDef(type);

      expect(def.fields.map((f) => f.path)).toEqual(["name", "email", "bio"]);
    });

    it("fields without @ui.order come after ordered fields", () => {
      const type = objectType({
        unordered: stringProp(),
        first: stringProp({ [UI_ORDER]: 1 }),
      });
      const def = createFormDef(type);

      expect(def.fields[0]!.path).toBe("first");
      expect(def.fields[1]!.path).toBe("unordered");
    });

    it("@ui.type annotation overrides default type inference", () => {
      const type = objectType({
        bio: stringProp({ [UI_TYPE]: "textarea" }),
      });
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("textarea");
    });

    it("@ui.hidden field still appears in fields", () => {
      const type = objectType({
        secret: stringProp({ [UI_HIDDEN]: true }),
        visible: stringProp(),
      });
      const def = createFormDef(type);

      expect(def.fields).toHaveLength(2);
      expect(def.fields.find((f) => f.path === "secret")).toBeDefined();
    });

    it("phantom type field has phantom: true", () => {
      const type = objectType({
        note: phantomProp(),
      });
      const def = createFormDef(type);

      expect(def.fields[0]!.phantom).toBe(true);
    });

    it("allStatic is true when no ui.fn.* annotations exist", () => {
      const type = objectType({ name: stringProp() });
      const def = createFormDef(type);

      expect(def.fields[0]!.allStatic).toBe(true);
    });
  });

  describe("nested objects", () => {
    it("inlines flat objects without @meta.label or @ui.component", () => {
      const inner = objectType({ street: stringProp(), city: stringProp() });
      const type = defineAnnotatedType("object").prop("address", inner).$type;
      const def = createFormDef(type);

      // Children should appear at top level (address.street, address.city)
      expect(def.fields.some((f) => f.path === "address.street")).toBe(true);
      expect(def.fields.some((f) => f.path === "address.city")).toBe(true);
      // The address object itself should NOT appear as a field
      expect(def.fields.find((f) => f.path === "address")).toBeUndefined();
    });

    it("keeps object as structured field when @meta.label is present", () => {
      const inner = objectType({ street: stringProp() }, { [META_LABEL]: "Address" });
      const type = defineAnnotatedType("object").prop("address", inner).$type;
      const def = createFormDef(type);

      const addressField = def.fields.find((f) => f.path === "address");
      expect(addressField).toBeDefined();
      expect(addressField!.type).toBe("object");
      expect(isObjectField(addressField!)).toBe(true);
    });

    it("keeps object as structured field when @ui.component is present", () => {
      const inner = objectType({ street: stringProp() }, { [UI_COMPONENT]: "custom-address" });
      const type = defineAnnotatedType("object").prop("address", inner).$type;
      const def = createFormDef(type);

      const addressField = def.fields.find((f) => f.path === "address");
      expect(addressField).toBeDefined();
    });
  });

  describe("array fields", () => {
    it("creates FormArrayFieldDef for array props", () => {
      const arrayType = defineAnnotatedType("array").of(stringProp()).$type;
      const type = defineAnnotatedType("object").prop("tags", arrayType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "tags");
      expect(field).toBeDefined();
      expect(field!.type).toBe("array");
      expect(isArrayField(field!)).toBe(true);

      const arrayField = field as FormArrayFieldDef;
      expect(arrayField.itemType).toBeDefined();
      expect(arrayField.itemField).toBeDefined();
      expect(arrayField.itemField.path).toBe("");
    });
  });

  describe("union fields", () => {
    it("creates FormUnionFieldDef for multi-variant unions", () => {
      const unionType = defineAnnotatedType("union").item(stringProp()).item(numberProp()).$type;
      const type = defineAnnotatedType("object").prop("value", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "value");
      expect(field).toBeDefined();
      expect(field!.type).toBe("union");
      expect(isUnionField(field!)).toBe(true);

      const unionField = field as FormUnionFieldDef;
      expect(unionField.unionVariants).toHaveLength(2);
    });

    it("unwraps single-variant unions", () => {
      const unionType = defineAnnotatedType("union").item(stringProp()).$type;
      const type = defineAnnotatedType("object").prop("value", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "value");
      expect(field).toBeDefined();
      // Should be unwrapped to the inner type, not a union
      expect(field!.type).not.toBe("union");
      expect(field!.type).toBe("text");
    });
  });

  describe("tuple fields", () => {
    it("creates FormTupleFieldDef for tuple types", () => {
      const tupleType = defineAnnotatedType("tuple").item(stringProp()).item(numberProp()).$type;
      const type = defineAnnotatedType("object").prop("pair", tupleType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "pair");
      expect(field).toBeDefined();
      expect(field!.type).toBe("tuple");
      expect(isTupleField(field!)).toBe(true);

      const tupleField = field as FormTupleFieldDef;
      expect(tupleField.itemFields).toHaveLength(2);
    });
  });

  describe("non-object root types", () => {
    it("wraps primitive types as single leaf root field", () => {
      const type = stringProp();
      const def = createFormDef(type);

      expect(def.rootField.path).toBe("");
      expect(def.rootField.type).toBe("text");
      expect(def.fields).toHaveLength(1);
      expect(def.fields[0]).toBe(def.rootField);
      expect(def.flatMap.size).toBe(0);
    });

    it("wraps array type as single root field", () => {
      const type = defineAnnotatedType("array").of(stringProp()).$type;
      const def = createFormDef(type);

      expect(def.rootField.type).toBe("array");
      expect(isArrayField(def.rootField)).toBe(true);
    });
  });

  describe("primitive tags", () => {
    it("resolves 'select' tag to select type", () => {
      const prop = defineAnnotatedType().designType("string").tags("select").$type;
      const type = defineAnnotatedType("object").prop("choice", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("select");
    });

    it("resolves 'radio' tag to radio type", () => {
      const prop = defineAnnotatedType().designType("string").tags("radio").$type;
      const type = defineAnnotatedType("object").prop("choice", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("radio");
    });

    it("resolves 'action' tag to action type with phantom", () => {
      const prop = defineAnnotatedType().designType("phantom").tags("action").$type;
      const type = defineAnnotatedType("object").prop("submit", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("action");
      expect(def.fields[0]!.phantom).toBe(true);
    });

    it("@ui.type takes priority over tags", () => {
      const prop = defineAnnotatedType().designType("string").tags("select").$type;
      prop.metadata.set(UI_TYPE as keyof AtscriptMetadata, "custom-select" as never);
      const type = defineAnnotatedType("object").prop("choice", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("custom-select");
    });
  });
});

describe("buildUnionVariants", () => {
  it("builds variants from union items", () => {
    const unionType = defineAnnotatedType("union").item(stringProp()).item(numberProp()).$type;

    const variants = buildUnionVariants(unionType);
    expect(variants).toHaveLength(2);
    expect(variants[0]!.label).toContain("String");
    expect(variants[1]!.label).toContain("Number");
  });

  it("uses @meta.label for object variant labels", () => {
    const obj = objectType({ name: stringProp() }, { [META_LABEL]: "Person" });
    const unionType = defineAnnotatedType("union").item(obj).item(stringProp()).$type;

    const variants = buildUnionVariants(unionType);
    expect(variants[0]!.label).toContain("Person");
  });

  it("single variant has no numeric prefix", () => {
    const unionType = defineAnnotatedType("union").item(stringProp()).$type;
    const variants = buildUnionVariants(unionType);

    expect(variants).toHaveLength(1);
    expect(variants[0]!.label).not.toMatch(/^\d+\./);
  });

  it("multiple variants have numeric prefixes", () => {
    const unionType = defineAnnotatedType("union").item(stringProp()).item(numberProp()).$type;
    const variants = buildUnionVariants(unionType);

    expect(variants[0]!.label).toMatch(/^1\./);
    expect(variants[1]!.label).toMatch(/^2\./);
  });
});
