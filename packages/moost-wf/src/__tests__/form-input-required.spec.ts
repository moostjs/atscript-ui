import { describe, expect, it } from "vitest";
import { FormInputRequired } from "../form-input-required";

describe("FormInputRequired", () => {
  it("stores schema", () => {
    const schema = { fields: [{ name: "email" }] };
    const fir = new FormInputRequired(schema);

    expect(fir.schema).toBe(schema);
    expect(fir.errors).toBeUndefined();
    expect(fir.context).toBeUndefined();
  });

  it("stores schema + errors", () => {
    const schema = { fields: [] };
    const errors = { email: "Required" };
    const fir = new FormInputRequired(schema, errors);

    expect(fir.schema).toBe(schema);
    expect(fir.errors).toEqual({ email: "Required" });
    expect(fir.context).toBeUndefined();
  });

  it("stores schema + errors + context", () => {
    const schema = { fields: [] };
    const errors = { password: "Too short" };
    const context = { passwordRules: ["min 8 chars"] };
    const fir = new FormInputRequired(schema, errors, context);

    expect(fir.schema).toBe(schema);
    expect(fir.errors).toEqual({ password: "Too short" });
    expect(fir.context).toEqual({ passwordRules: ["min 8 chars"] });
  });

  it("is an instance of FormInputRequired", () => {
    const fir = new FormInputRequired({});
    expect(fir).toBeInstanceOf(FormInputRequired);
  });
});
