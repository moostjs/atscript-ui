import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_UNIT,
  DB_UNIT_REF,
  META_LABEL,
  UI_FORM_COMPONENT,
  UI_FORM_HIDDEN,
  UI_FORM_ORDER,
  UI_FORM_PREFIX,
  UI_FORM_PREFIX_REF,
  UI_FORM_SUFFIX,
  UI_FORM_SUFFIX_REF,
  UI_FORM_TYPE,
  UI_TYPE,
} from "../shared/annotation-keys";
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

    it("sorts fields by @ui.form.order", () => {
      const type = objectType({
        email: stringProp({ [UI_FORM_ORDER]: 2 }),
        name: stringProp({ [UI_FORM_ORDER]: 1 }),
        bio: stringProp({ [UI_FORM_ORDER]: 3 }),
      });
      const def = createFormDef(type);

      expect(def.fields.map((f) => f.path)).toEqual(["name", "email", "bio"]);
    });

    it("fields without @ui.form.order come after ordered fields", () => {
      const type = objectType({
        unordered: stringProp(),
        first: stringProp({ [UI_FORM_ORDER]: 1 }),
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

    it("@ui.form.hidden field still appears in fields", () => {
      const type = objectType({
        secret: stringProp({ [UI_FORM_HIDDEN]: true }),
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

    it("skips opts.versionColumn from fields[] but keeps it in flatMap", () => {
      const type = objectType({
        name: stringProp(),
        age: numberProp(),
        version: numberProp(),
      });

      const def = createFormDef(type, { versionColumn: "version" });
      // OCC version column must not render as a user-editable field.
      expect(def.fields.map((f) => f.path)).toEqual(["name", "age"]);
      // But it must remain in the type tree — wire serialization and the
      // server-side $cas auto-lift rely on the field still existing.
      expect(def.flatMap.has("version")).toBe(true);

      // Control: without the opt, the field renders normally — proves the
      // skip is opt-in and non-versioned tables stay unaffected.
      const defNoOpt = createFormDef(type);
      expect(defNoOpt.fields.map((f) => f.path)).toContain("version");
    });
  });

  describe("nested objects", () => {
    it("inlines flat objects without @meta.label or @ui.form.component", () => {
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

    it("keeps object as structured field when @ui.form.component is present", () => {
      const inner = objectType({ street: stringProp() }, { [UI_FORM_COMPONENT]: "custom-address" });
      const type = defineAnnotatedType("object").prop("address", inner).$type;
      const def = createFormDef(type);

      const addressField = def.fields.find((f) => f.path === "address");
      expect(addressField).toBeDefined();
    });

    it("@ui.form.type on a structured object surfaces as `customType`, type stays 'object'", () => {
      const inner = objectType(
        { street: stringProp() },
        { [META_LABEL]: "Address", [UI_FORM_TYPE]: "address-card" },
      );
      const type = defineAnnotatedType("object").prop("address", inner).$type;
      const def = createFormDef(type);

      const addressField = def.fields.find((f) => f.path === "address");
      expect(addressField!.type).toBe("object");
      expect(isObjectField(addressField!)).toBe(true);
      expect(addressField!.customType).toBe("address-card");
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

    it("@ui.form.type on an array field surfaces as `customType`, type stays 'array'", () => {
      const arrayType = defineAnnotatedType("array").of(stringProp()).$type;
      arrayType.metadata.set(UI_FORM_TYPE as keyof AtscriptMetadata, "tag-input" as never);
      const type = defineAnnotatedType("object").prop("tags", arrayType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "tags");
      // Kind stays — type guards / validator / item recursion keep working.
      expect(field!.type).toBe("array");
      expect(isArrayField(field!)).toBe(true);
      // Override surfaces on `customType` for the renderer's types-map lookup.
      expect(field!.customType).toBe("tag-input");
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

    it("pure literal union becomes select (not union)", () => {
      const literalA = defineAnnotatedType().designType("string").value("a").$type;
      const literalB = defineAnnotatedType().designType("string").value("b").$type;
      const unionType = defineAnnotatedType("union").item(literalA).item(literalB).$type;
      const type = defineAnnotatedType("object").prop("choice", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "choice");
      expect(field).toBeDefined();
      expect(field!.type).toBe("select");
      expect(isUnionField(field!)).toBe(false);
    });

    it("@ui.type overrides literal union auto-select (e.g. radio)", () => {
      const literalA = defineAnnotatedType().designType("string").value("a").$type;
      const literalB = defineAnnotatedType().designType("string").value("b").$type;
      const unionType = defineAnnotatedType("union").item(literalA).item(literalB).$type;
      unionType.metadata.set(UI_TYPE as keyof AtscriptMetadata, "radio" as never);
      const type = defineAnnotatedType("object").prop("choice", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "choice");
      expect(field!.type).toBe("radio");
    });

    it("mixed union (literal + non-literal) stays as union", () => {
      const literalA = defineAnnotatedType().designType("string").value("a").$type;
      const unionType = defineAnnotatedType("union").item(literalA).item(numberProp()).$type;
      const type = defineAnnotatedType("object").prop("value", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "value");
      expect(field!.type).toBe("union");
      expect(isUnionField(field!)).toBe(true);
    });

    it("@ui.form.type on a multi-variant union surfaces as `customType`, type stays 'union'", () => {
      const unionType = defineAnnotatedType("union").item(stringProp()).item(numberProp()).$type;
      unionType.metadata.set(UI_FORM_TYPE as keyof AtscriptMetadata, "contact-card" as never);
      const type = defineAnnotatedType("object").prop("contact", unionType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "contact");
      expect(field!.type).toBe("union");
      expect(isUnionField(field!)).toBe(true);
      expect(field!.customType).toBe("contact-card");
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

    it("@ui.form.type on a tuple field surfaces as `customType`, type stays 'tuple'", () => {
      const tupleType = defineAnnotatedType("tuple")
        .item(numberProp())
        .item(numberProp())
        .item(numberProp()).$type;
      tupleType.metadata.set(UI_FORM_TYPE as keyof AtscriptMetadata, "rgb-picker" as never);
      const type = defineAnnotatedType("object").prop("logoRgb", tupleType).$type;
      const def = createFormDef(type);

      const field = def.fields.find((f) => f.path === "logoRgb");
      expect(field!.type).toBe("tuple");
      expect(isTupleField(field!)).toBe(true);
      expect(field!.customType).toBe("rgb-picker");
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

  describe("measurement & date dispatch", () => {
    it("number.timestamp tag → 'datetime' type", () => {
      const prop = defineAnnotatedType().designType("number").tags("number", "timestamp").$type;
      const type = defineAnnotatedType("object").prop("at", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("datetime");
    });

    it("decimal design type alone → 'decimal' type", () => {
      const prop = defineAnnotatedType().designType("decimal").tags("decimal").$type;
      const type = defineAnnotatedType("object").prop("score", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@db.amount.currency on number → 'decimal' type (currency forces decimal chrome)", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(DB_AMOUNT_CURRENCY as keyof AtscriptMetadata, "USD" as never);
      const type = defineAnnotatedType("object").prop("price", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@db.amount.currency on decimal → 'decimal' type", () => {
      const prop = defineAnnotatedType().designType("decimal").tags("decimal").$type;
      prop.metadata.set(DB_AMOUNT_CURRENCY as keyof AtscriptMetadata, "EUR" as never);
      const type = defineAnnotatedType("object").prop("total", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@db.amount.currency.ref → 'decimal' type", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(DB_AMOUNT_CURRENCY_REF as keyof AtscriptMetadata, "currency" as never);
      const type = defineAnnotatedType("object").prop("total", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@db.unit on number → 'number' type (single-input with suffix)", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(DB_UNIT as keyof AtscriptMetadata, "kg" as never);
      const type = defineAnnotatedType("object").prop("weight", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("number");
    });

    it("@db.unit on decimal → 'decimal' type (decimal chrome with unit suffix)", () => {
      const prop = defineAnnotatedType().designType("decimal").tags("decimal").$type;
      prop.metadata.set(DB_UNIT as keyof AtscriptMetadata, "°C" as never);
      const type = defineAnnotatedType("object").prop("temperature", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@db.unit.ref on number → 'number' type", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(DB_UNIT_REF as keyof AtscriptMetadata, "unitCode" as never);
      const type = defineAnnotatedType("object").prop("weight", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("number");
    });

    it("@ui.form.prefix on number → 'number' type (adornment forces dispatch)", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(UI_FORM_PREFIX as keyof AtscriptMetadata, "+1" as never);
      const type = defineAnnotatedType("object").prop("rate", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("number");
    });

    it("@ui.form.suffix on decimal → 'decimal' type", () => {
      const prop = defineAnnotatedType().designType("decimal").tags("decimal").$type;
      prop.metadata.set(UI_FORM_SUFFIX as keyof AtscriptMetadata, "/100" as never);
      const type = defineAnnotatedType("object").prop("score", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("@ui.form.suffix.ref on number → 'number' type", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(UI_FORM_SUFFIX_REF as keyof AtscriptMetadata, "unit" as never);
      const type = defineAnnotatedType("object").prop("quantity", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("number");
    });

    it("@ui.form.prefix.ref on decimal → 'decimal' type", () => {
      const prop = defineAnnotatedType().designType("decimal").tags("decimal").$type;
      prop.metadata.set(UI_FORM_PREFIX_REF as keyof AtscriptMetadata, "currency" as never);
      const type = defineAnnotatedType("object").prop("amt", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("decimal");
    });

    it("plain number without any adornment → falls through to designType ('number' from dt branch)", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      const type = defineAnnotatedType("object").prop("count", prop).$type;
      const def = createFormDef(type);

      // dt === 'number' fallback — single AsInput type=number.
      expect(def.fields[0]!.type).toBe("number");
    });

    it("@ui.form.type wins over currency dispatch", () => {
      const prop = defineAnnotatedType().designType("number").tags("number").$type;
      prop.metadata.set(DB_AMOUNT_CURRENCY as keyof AtscriptMetadata, "USD" as never);
      prop.metadata.set(UI_FORM_TYPE as keyof AtscriptMetadata, "text" as never);
      const type = defineAnnotatedType("object").prop("price", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("text");
    });

    it("@ui.form.type 'date' selects date input", () => {
      const prop = defineAnnotatedType().designType("string").tags("string").$type;
      prop.metadata.set(UI_FORM_TYPE as keyof AtscriptMetadata, "date" as never);
      const type = defineAnnotatedType("object").prop("d", prop).$type;
      const def = createFormDef(type);

      expect(def.fields[0]!.type).toBe("date");
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

// ── FK ref auto-detection (uses pre-compiled .as fixtures) ────

describe("FK ref fields", () => {
  it("FK prop auto-detects as type: ref", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const def = createFormDef(BookForm);

    const fkField = def.fields.find((f) => f.path === "authorId");
    expect(fkField).toBeDefined();
    expect(fkField!.type).toBe("ref");
  });

  it("FK prop respects @ui.type override", async () => {
    const { OverriddenForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const def = createFormDef(OverriddenForm);

    const fkField = def.fields.find((f) => f.path === "authorId");
    expect(fkField!.type).toBe("text");
  });

  it("prop with .ref but no @db.http.path falls through to normal type", async () => {
    const { OrphanRefForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const def = createFormDef(OrphanRefForm);

    const fkField = def.fields.find((f) => f.path === "orphanId");
    expect(fkField!.type).toBe("number");
  });
});
