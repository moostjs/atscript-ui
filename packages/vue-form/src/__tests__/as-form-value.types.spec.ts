// Type-level checks, enforced by the type-aware lint (`vp lint`): what the
// form's events carry for each shape of `formData` container.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { FormDef } from "@atscript/ui";
import type { TAsFormValue } from "../composables/use-as-form";
import type { TAsFormError, TAsFormSubmitResult, UseAsFormOptions } from "../index";

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

describe("submit outcome and the exported form types", () => {
  type Container = { value: Product };

  it("a submit returns the container's value or the error list", () => {
    expectTypeOf<TAsFormSubmitResult<Container>>().toEqualTypeOf<
      { ok: true; data: Product } | { ok: false; errors: TAsFormError[] }
    >();
    expect(true).toBe(true);
  });

  it("the error callback carries TAsFormError[]", () => {
    type ErrorCallback = NonNullable<NonNullable<UseAsFormOptions["emits"]>["error"]>;
    expectTypeOf<Parameters<ErrorCallback>[0]>().toEqualTypeOf<TAsFormError[]>();
    expectTypeOf<TAsFormError>().toEqualTypeOf<{ path: string; message: string }>();
  });

  // An existing `@error` handler typed with a record keeps compiling: an
  // interface would have no implicit index signature and break it.
  it("an error entry is assignable to Record<string, string>", () => {
    type ErrorCallback = NonNullable<NonNullable<UseAsFormOptions["emits"]>["error"]>;
    expectTypeOf<TAsFormError>().toExtend<Record<string, string>>();
    expectTypeOf<(errors: Record<string, string>[]) => void>().toExtend<ErrorCallback>();
  });

  it("useAsForm options need no `types`", () => {
    expectTypeOf<{ def: () => FormDef }>().toExtend<UseAsFormOptions>();
  });
});
