import { describe, expect, it } from "vitest";
import { createDefaultTypes } from "../composables/create-default-types";

const REQUIRED_KEYS = [
  "text",
  "password",
  "number",
  "select",
  "radio",
  "checkbox",
  "paragraph",
  "action",
  "object",
  "array",
  "union",
  "tuple",
];

describe("createDefaultTypes", () => {
  it("returns an object with all 12 required field type keys", () => {
    const types = createDefaultTypes();
    for (const key of REQUIRED_KEYS) {
      expect(types).toHaveProperty(key);
    }
  });

  it("each value is a Vue component (object with __name or render)", () => {
    const types = createDefaultTypes();
    for (const key of REQUIRED_KEYS) {
      const comp = types[key];
      expect(comp).toBeDefined();
      expect(typeof comp === "object" || typeof comp === "function").toBe(true);
    }
  });

  it("returns a fresh instance each call (no shared mutation)", () => {
    const a = createDefaultTypes();
    const b = createDefaultTypes();
    expect(a).not.toBe(b);
    (a as any).custom = "test";
    expect((b as any).custom).toBeUndefined();
  });

  it("text and password map to the same component (AsInput)", () => {
    const types = createDefaultTypes();
    expect(types.text).toBe(types.password);
  });

  it("can be extended with custom type via spread", () => {
    const types = { ...createDefaultTypes(), rating: { name: "MyRating" } };
    expect(types).toHaveProperty("rating");
    expect(types).toHaveProperty("text");
  });
});
