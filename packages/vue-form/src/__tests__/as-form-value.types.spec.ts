// Type-level checks, enforced by the type-aware lint (`vp lint`): what the
// form's events carry for each shape of `formData` container.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { TAsFormValue } from "../composables/use-as-form";

interface Product {
  id: number;
  name: string;
}

describe("TAsFormValue", () => {
  it("is the value inside the container", () => {
    expectTypeOf<TAsFormValue<{ value: Product }>>().toEqualTypeOf<Product>();
    expectTypeOf<TAsFormValue<{ value?: Product }>>().toEqualTypeOf<Product>();
    expect(true).toBe(true);
  });

  it("stays loose for an untyped container and unknown without one", () => {
    expectTypeOf<TAsFormValue<any>>().toBeAny();
    expectTypeOf<TAsFormValue<unknown>>().toBeUnknown();
    expectTypeOf<TAsFormValue<{ other: Product }>>().toBeUnknown();
  });
});
