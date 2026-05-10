import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { createFormDef, createFormData } from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { useAsForm, type UseAsFormReturn } from "../composables/use-as-form";
import { createDefaultTypes } from "../composables/create-default-types";
import { objectType, stringProp } from "./helpers";

/**
 * Mount a custom form root that calls `useAsForm()` directly — proves the
 * composable works WITHOUT `<AsForm>`. This is the closest thing to a
 * compile-time contract for the customer-reuse surface.
 */
function mountCustomForm(opts: {
  type: TAtscriptAnnotatedType;
  initialValue?: Record<string, unknown>;
  errors?: Record<string, string | undefined>;
  emits?: {
    submit?: (data: unknown) => void;
    error?: (errs: { path: string; message: string }[]) => void;
  };
}) {
  const def = createFormDef(opts.type);
  const formData = reactive(
    opts.initialValue !== undefined ? { value: opts.initialValue } : createFormData(opts.type),
  ) as { value: Record<string, unknown> };
  const errorsRef = ref<Record<string, string | undefined> | undefined>(opts.errors);
  let api!: UseAsFormReturn;

  const Custom = defineComponent({
    setup() {
      api = useAsForm({
        def: () => def,
        formData: () => formData,
        types: () => createDefaultTypes(),
        errors: () => errorsRef.value,
        emits: opts.emits,
      });
      return () =>
        h("form", { class: "custom-form", onSubmit: (e: Event) => e.preventDefault() }, [
          // We don't need to render fields — the composable contract
          // doesn't depend on a particular template.
        ]);
    },
  });

  const wrapper = mount(Custom);
  return {
    wrapper,
    formData,
    errorsRef,
    get api() {
      return api;
    },
  };
}

describe("useAsForm — customer-reuse contract", () => {
  it("exposes the form-data container via `data`", async () => {
    const type = objectType({ name: stringProp() });
    const { api, formData } = mountCustomForm({
      type,
      initialValue: { name: "Alice" },
    });
    expect(api.data.value).toBe(formData);
    expect((api.data.value as { value: { name: string } }).value.name).toBe("Alice");
  });

  it("`onSubmit()` emits `submit` with unwrapped domain data on success", async () => {
    const submit = vi.fn();
    const type = objectType({ name: stringProp() });
    const { api } = mountCustomForm({
      type,
      initialValue: { name: "Alice" },
      emits: { submit },
    });
    api.onSubmit();
    await nextTick();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("`onSubmit()` emits `error` when validator finds problems", async () => {
    const submit = vi.fn();
    const error = vi.fn();
    const { RequiredForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({
      type: RequiredForm,
      emits: { submit, error },
    });
    api.onSubmit();
    await nextTick();
    expect(submit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const errs = error.mock.calls[0]![0] as { path: string; message: string }[];
    expect(errs.some((e) => e.message === "Name is required")).toBe(true);
  });

  it("`errors` reflects external errors and `dismissError(path)` removes a leaf", async () => {
    const type = objectType({ name: stringProp() });
    const { api } = mountCustomForm({
      type,
      errors: { name: "Server says no", __form: "down" },
    });
    expect(api.errors.value).toEqual({ name: "Server says no" });
    expect(api.formError.value).toBe("down");

    api.dismissError("name");
    await nextTick();
    expect(api.errors.value).toEqual({});
  });

  it("`dismissFormError()` hides the form-level banner until a fresh errors arrive", async () => {
    const type = objectType({ name: stringProp() });
    const { api, errorsRef } = mountCustomForm({
      type,
      errors: { __form: "Server explosion" },
    });
    expect(api.formError.value).toBe("Server explosion");

    api.dismissFormError();
    await nextTick();
    expect(api.formError.value).toBeUndefined();

    // A fresh errors-prop identity re-arms the banner.
    errorsRef.value = { __form: "Still exploded" };
    await nextTick();
    expect(api.formError.value).toBe("Still exploded");
  });
});
