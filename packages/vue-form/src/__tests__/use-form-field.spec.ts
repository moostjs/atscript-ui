import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, provide, reactive, ref, type Ref } from "vue";
import { useFormField } from "../composables/use-form-field";
import type { TFormFieldRegistration, TFormState } from "../composables/types";

/**
 * Sets up useFormField inside a child component whose *parent* provides
 * the injections, exactly as the real app does (inject reads parent, not self).
 */
function setupFormField(
  opts: {
    getValue?: () => unknown;
    setValue?: (v: unknown) => void;
    rules?: Array<(v: unknown, data?: unknown, ctx?: unknown) => boolean | string>;
    path?: () => string;
    resetValue?: unknown;
    formData?: Record<string, unknown>;
    formContext?: Record<string, unknown>;
  },
  formStateOverrides?: Partial<TFormState>,
) {
  // Shared ref so getValue/setValue stay in sync when no custom ones given
  const valueRef = ref(opts.getValue ? opts.getValue() : "") as Ref<unknown>;

  const formState = reactive<TFormState>({
    firstSubmitHappened: false,
    firstValidation: "on-change",
    register: vi.fn(),
    unregister: vi.fn(),
    ...formStateOverrides,
  });

  let result!: ReturnType<typeof useFormField>;

  // Child that calls useFormField (picks up injections from parent)
  const Child = defineComponent({
    setup() {
      result = useFormField({
        getValue: opts.getValue ?? (() => valueRef.value),
        setValue:
          opts.setValue ??
          ((v: unknown) => {
            valueRef.value = v;
          }),
        rules: opts.rules,
        path: opts.path ?? (() => "field"),
        resetValue: opts.resetValue,
      });
      return {};
    },
    render: () => null,
  });

  // Parent that provides the form injections
  const Parent = defineComponent({
    setup() {
      provide("__as_form", formState);
      provide(
        "__as_form_data",
        computed(() => opts.formData ?? {}),
      );
      provide(
        "__as_form_context",
        computed(() => opts.formContext ?? {}),
      );
      return () => h(Child);
    },
  });

  const wrapper = mount(Parent);

  return { ...result!, formState, wrapper, valueRef };
}

/** Get the registration that was passed to formState.register */
function getRegistration(formState: TFormState): TFormFieldRegistration {
  const mock = formState.register as ReturnType<typeof vi.fn>;
  return mock.mock.calls[0]![1];
}

/** Get the symbol id that was passed to formState.register */
function getRegisteredId(formState: TFormState): symbol {
  const mock = formState.register as ReturnType<typeof vi.fn>;
  return mock.mock.calls[0]![0];
}

describe("useFormField", () => {
  // ── model ─────────────────────────────────────────────────

  it("model.get calls getValue", () => {
    const getValue = vi.fn(() => "hello");
    const { model } = setupFormField({ getValue });
    expect(model.value).toBe("hello");
    expect(getValue).toHaveBeenCalled();
  });

  it("model.set calls setValue", () => {
    const setValue = vi.fn();
    const { model } = setupFormField({ getValue: () => "", setValue });
    model.value = "world";
    expect(setValue).toHaveBeenCalledWith("world");
  });

  // ── error — inactive ─────────────────────────────────────

  it("error returns undefined when validation is inactive (not touched, not submitted)", () => {
    const { error } = setupFormField({
      rules: [() => "Required"],
    });
    // on-change mode, not touched, not submitted => inactive
    expect(error.value).toBeUndefined();
  });

  // ── error — active ───────────────────────────────────────

  it("error returns rule error when on-change mode and touched", async () => {
    const valueRef = ref("initial");
    const { error, model: _model } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
      rules: [() => "Required"],
    });
    // Trigger the watcher by changing the underlying ref
    valueRef.value = "changed";
    await nextTick();
    // Now touched is true, on-change is active
    expect(error.value).toBe("Required");
  });

  it("error returns external error with priority over rule errors", async () => {
    const valueRef = ref("");
    const { error, formState } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
      rules: [() => "Rule error"],
    });
    // Touch the field so validation is active
    valueRef.value = "x";
    await nextTick();
    expect(error.value).toBe("Rule error");

    // Set external error via the registered callbacks
    const registration = getRegistration(formState);
    registration.callbacks.setExternalError("External error");
    await nextTick();

    expect(error.value).toBe("External error");
  });

  // ── validation modes ──────────────────────────────────────

  it("on-change: active after touch or after firstSubmitHappened", async () => {
    const valueRef = ref("");
    const { error } = setupFormField(
      {
        getValue: () => valueRef.value,
        setValue: (v: unknown) => {
          valueRef.value = v as string;
        },
        rules: [() => "err"],
      },
      { firstValidation: "on-change" },
    );

    // Not touched, not submitted -> inactive
    expect(error.value).toBeUndefined();

    // Touch -> active
    valueRef.value = "a";
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("on-change: active after firstSubmitHappened", async () => {
    const { error, formState } = setupFormField(
      { rules: [() => "err"] },
      { firstValidation: "on-change" },
    );
    expect(error.value).toBeUndefined();
    formState.firstSubmitHappened = true;
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("on-blur: active after blur or after firstSubmitHappened", async () => {
    const { error, onBlur } = setupFormField(
      { rules: [() => "err"] },
      { firstValidation: "on-blur" },
    );
    expect(error.value).toBeUndefined();

    onBlur();
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("on-blur: active after firstSubmitHappened", async () => {
    const { error, formState } = setupFormField(
      { rules: [() => "err"] },
      { firstValidation: "on-blur" },
    );
    expect(error.value).toBeUndefined();
    formState.firstSubmitHappened = true;
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("touched-on-blur: active only after touch AND blur, or after firstSubmitHappened", async () => {
    const valueRef = ref("");
    const { error, onBlur } = setupFormField(
      {
        getValue: () => valueRef.value,
        setValue: (v: unknown) => {
          valueRef.value = v as string;
        },
        rules: [() => "err"],
      },
      { firstValidation: "touched-on-blur" },
    );

    // Neither touched nor blurred
    expect(error.value).toBeUndefined();

    // Only touched (not blurred) -> still inactive
    valueRef.value = "a";
    await nextTick();
    expect(error.value).toBeUndefined();

    // Now blur -> active (touched AND blurred)
    onBlur();
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("touched-on-blur: active after firstSubmitHappened", async () => {
    const { error, formState } = setupFormField(
      { rules: [() => "err"] },
      { firstValidation: "touched-on-blur" },
    );
    expect(error.value).toBeUndefined();
    formState.firstSubmitHappened = true;
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("on-submit: active only after firstSubmitHappened", async () => {
    const valueRef = ref("");
    const { error, onBlur, formState } = setupFormField(
      {
        getValue: () => valueRef.value,
        setValue: (v: unknown) => {
          valueRef.value = v as string;
        },
        rules: [() => "err"],
      },
      { firstValidation: "on-submit" },
    );

    // Touch + blur should NOT activate
    valueRef.value = "a";
    await nextTick();
    onBlur();
    await nextTick();
    expect(error.value).toBeUndefined();

    // Submit activates it
    formState.firstSubmitHappened = true;
    await nextTick();
    expect(error.value).toBe("err");
  });

  it("none: never active", async () => {
    const valueRef = ref("");
    const { error, onBlur, formState } = setupFormField(
      {
        getValue: () => valueRef.value,
        setValue: (v: unknown) => {
          valueRef.value = v as string;
        },
        rules: [() => "err"],
      },
      { firstValidation: "none" },
    );

    valueRef.value = "a";
    await nextTick();
    onBlur();
    await nextTick();
    formState.firstSubmitHappened = true;
    await nextTick();
    expect(error.value).toBeUndefined();
  });

  // ── clearErrors ───────────────────────────────────────────

  it("clearErrors resets touched, blur, submitError, externalError", async () => {
    const valueRef = ref("");
    const { error, onBlur, formState } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
      rules: [() => "err"],
    });

    // Touch + blur to make validation active
    valueRef.value = "x";
    await nextTick();
    onBlur();
    await nextTick();
    expect(error.value).toBe("err");

    // Call clearErrors through the registered callbacks
    const registration = getRegistration(formState);
    registration.callbacks.clearErrors();
    await nextTick();

    // After clear, touched and blur are reset -> validation inactive -> no error
    expect(error.value).toBeUndefined();
  });

  // ── reset ─────────────────────────────────────────────────

  it("reset sets model to resetValue (default '')", () => {
    const valueRef = ref("hello");
    const { formState } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
    });

    const registration = getRegistration(formState);
    registration.callbacks.reset();
    expect(valueRef.value).toBe("");
  });

  it("reset sets model to custom resetValue when provided", () => {
    const valueRef = ref("hello");
    const { formState } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
      resetValue: "default",
    });

    const registration = getRegistration(formState);
    registration.callbacks.reset();
    expect(valueRef.value).toBe("default");
  });

  // ── watcher ───────────────────────────────────────────────

  it("watcher clears submitError and externalError when model changes", async () => {
    const valueRef = ref("");
    const { error, formState } = setupFormField({
      getValue: () => valueRef.value,
      setValue: (v: unknown) => {
        valueRef.value = v as string;
      },
      rules: [() => "err"],
    });

    // Simulate submit that sets submitError via the validate callback
    const registration = getRegistration(formState);
    registration.callbacks.validate(); // sets submitError
    await nextTick();
    expect(error.value).toBe("err");

    // Set external error too
    registration.callbacks.setExternalError("external");
    await nextTick();
    expect(error.value).toBe("external"); // external has priority

    // Now change the model -> watcher should clear both
    valueRef.value = "new";
    await nextTick();
    // Validation is active (touched), but submit/external errors are cleared.
    // Rule still returns "err" so error should come from the rule.
    expect(error.value).toBe("err");
  });

  it("watcher sets touched to true when model changes", async () => {
    const valueRef = ref("");
    const { error } = setupFormField(
      {
        getValue: () => valueRef.value,
        setValue: (v: unknown) => {
          valueRef.value = v as string;
        },
        rules: [() => "err"],
      },
      { firstValidation: "on-change" },
    );

    // Not yet touched -> no error
    expect(error.value).toBeUndefined();

    // Change triggers watcher -> touched = true -> on-change is active
    valueRef.value = "x";
    await nextTick();
    expect(error.value).toBe("err");
  });

  // ── registration ──────────────────────────────────────────

  it("registers with formState on creation", () => {
    const { formState } = setupFormField({});
    expect(formState.register).toHaveBeenCalledOnce();

    const mock = formState.register as ReturnType<typeof vi.fn>;
    const call = mock.mock.calls[0]!;
    expect(typeof call[0]).toBe("symbol");
    expect(call[1]).toHaveProperty("path");
    expect(call[1]).toHaveProperty("callbacks");
  });

  it("unregisters on unmount", () => {
    const { formState, wrapper } = setupFormField({});

    const registeredId = getRegisteredId(formState);
    wrapper.unmount();

    expect(formState.unregister).toHaveBeenCalledWith(registeredId);
  });
});
