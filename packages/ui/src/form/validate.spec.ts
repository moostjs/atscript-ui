import { describe, expect, it } from "vitest";
import { DerivedRow } from "../__tests__/fixtures/create-form-def.as";
import { BookForm } from "../__tests__/fixtures/value-help-fk.as";
import { createFormDef } from "./create-form-def";
import { createFieldValidator, getFormValidator } from "./validate";

// A create form: the user filled only what they own. `customerId` is a
// REQUIRED (`@meta.required`, non-optional) `@db.column.derived` field;
// `createdAt` (`@db.default.now`) and `version` (`@db.column.version`) are
// server-managed too.
const created = { id: 1, name: "Ada", payload: { customer: { id: "c1" } } };

describe("server-managed db fields", () => {
  it("a create form leaving derived / default / version empty passes the form validator", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    expect(validate({ data: created })).toEqual({});
    // A derived value is never validated — `@meta.required` on "" included.
    expect(validate({ data: { ...created, customerId: "" } })).toEqual({});
  });

  it("the per-field validator passes an empty derived field", () => {
    const prop = createFormDef(DerivedRow).flatMap.get("customerId")!;
    const validate = createFieldValidator(prop);
    expect(validate(undefined)).toBe(true);
    expect(validate("")).toBe(true);
  });

  it("an ordinary required field still fails", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    const { name: _, ...rest } = created;
    expect(Object.keys(validate({ data: rest }))).toEqual(["name"]);
  });

  it("a present @db.default value is still validated", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    expect(Object.keys(validate({ data: { ...created, createdAt: "now" } }))).toEqual([
      "createdAt",
    ]);
  });

  it("an empty required FK still fails (the form fills it, not the server)", () => {
    const validate = getFormValidator(createFormDef(BookForm));
    expect(Object.keys(validate({ data: { title: "Dune" } }))).toEqual(["authorId"]);
  });
});
