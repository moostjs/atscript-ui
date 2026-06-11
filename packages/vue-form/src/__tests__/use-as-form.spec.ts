import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { createFormDef, createFormData, defaultResolver, setResolver } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { useAsForm, type UseAsFormReturn } from "../composables/use-as-form";
import { createDefaultTypes } from "../composables/create-default-types";
import { mountForm, objectType, stringProp } from "./helpers";

/**
 * Mount a custom form root that calls `useAsForm()` directly — proves the
 * composable works WITHOUT `<AsForm>`. This is the closest thing to a
 * compile-time contract for the customer-reuse surface.
 */
function mountCustomForm(opts: {
  type: TAtscriptAnnotatedType;
  initialValue?: Record<string, unknown>;
  formContext?: Record<string, unknown>;
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
        formContext: () => opts.formContext,
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

describe("useAsForm — root title/description (static resolver)", () => {
  it("resolves root @meta.label / @meta.description statically", async () => {
    const { StaticTitleForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({ type: StaticTitleForm });
    expect(api.title.value).toBe("Static Root Title");
    expect(api.description.value).toBe("Static root description");
  });

  it("stays undefined when the root carries no label/description", async () => {
    const { RequiredForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({ type: RequiredForm });
    expect(api.title.value).toBeUndefined();
    expect(api.description.value).toBeUndefined();
  });

  it("ignores @ui.form.fn.title without ui-fns (no static fallback → undefined)", async () => {
    const { FnTitleContextForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({ type: FnTitleContextForm });
    expect(api.title.value).toBeUndefined();
  });
});

describe("useAsForm — root title is a FORM-level fn `(data, context)`", () => {
  // Root `@ui.form.fn.title` / `@ui.form.fn.description` compile via ui-fns'
  // `compileTopFn` and are invoked `(data, context)` — same contract as
  // `@ui.form.fn.submit.text` / `submit.disabled`. Field-level fns (resolved
  // in as-field.vue) keep the `(v, data, context, entry)` shape.
  beforeAll(() => installDynamicResolver());
  afterAll(() => setResolver(defaultResolver));

  it("root @ui.form.fn.title `(data, ctx)` receives formContext as ctx", async () => {
    const { FnTitleContextForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({
      type: FnTitleContextForm,
      // data.email differs from ctx.email — proves the 2nd arg is the
      // formContext, not the form data (the regression bound it to data).
      initialValue: { email: "data@example.com" },
      formContext: { email: "ctx@example.com" },
    });
    expect(api.title.value).toBe("Code sent to ctx@example.com");
  });

  it("root @ui.form.fn.title `(data)` receives form data as first arg", async () => {
    const { FnTitleDataForm } = await import("./fixtures/form-features.as");
    const { api, formData } = mountCustomForm({
      type: FnTitleDataForm,
      initialValue: { firstName: "Alice" },
    });
    expect(api.title.value).toBe("Hello Alice");

    // Reactive: title recomputes when form data changes.
    formData.value.firstName = "";
    await nextTick();
    expect(api.title.value).toBe("Anonymous");
  });

  it("root @ui.form.fn.description `(data, ctx)` receives formContext as ctx", async () => {
    const { FnTitleContextForm } = await import("./fixtures/form-features.as");
    const { api } = mountCustomForm({
      type: FnTitleContextForm,
      initialValue: { email: "data@example.com" },
      formContext: { email: "ctx@example.com" },
    });
    expect(api.description.value).toBe("We emailed ctx@example.com");
  });

  it("rendered root heading + description (AsField path) honor the form-level contract", async () => {
    // The visible `<h2 class="as-form-title">` / `<p class="as-form-description">`
    // come from AsField's resolution (rendered via AsObject for the root field),
    // not from `useAsForm().title` — both paths must apply the same
    // `(data, context)` contract at the root.
    const { FnTitleContextForm } = await import("./fixtures/form-features.as");
    const { wrapper } = mountForm(FnTitleContextForm, {
      initialValue: { email: "data@example.com" },
      formContext: { email: "ctx@example.com" },
    });
    await nextTick();
    expect(wrapper.find(".as-form-title").text()).toBe("Code sent to ctx@example.com");
    expect(wrapper.find(".as-form-description").text()).toBe("We emailed ctx@example.com");
  });
});
