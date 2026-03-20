import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { useFormState } from "../composables/use-form-state";
import type { TFormFieldRegistration } from "../composables/types";

// Helper to run useFormState inside a component (provide requires setup context)
function setupFormState(opts?: Record<string, unknown>) {
  let result!: ReturnType<typeof useFormState>;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useFormState({
          formData: ref({ value: {} }),
          formContext: ref({}),
          ...opts,
        });
        return {};
      },
      render: () => null,
    }),
  );
  return { ...result, wrapper };
}

/** Build a mock field registration with sensible defaults. */
function mockField(
  path: string,
  overrides?: Partial<TFormFieldRegistration["callbacks"]>,
): { id: symbol; registration: TFormFieldRegistration } {
  const id = Symbol(path);
  const registration: TFormFieldRegistration = {
    path: () => path,
    callbacks: {
      validate: vi.fn(() => true as string | boolean),
      clearErrors: vi.fn(),
      reset: vi.fn(),
      setExternalError: vi.fn(),
      ...overrides,
    },
  };
  return { id, registration };
}

describe("useFormState", () => {
  // ── submit ────────────────────────────────────────────────

  it("submit() returns true when no fields are registered", () => {
    const { submit } = setupFormState();
    expect(submit()).toBe(true);
  });

  it("submit() sets firstSubmitHappened to true", () => {
    const { submit, formState } = setupFormState();
    expect(formState.firstSubmitHappened).toBe(false);
    submit();
    expect(formState.firstSubmitHappened).toBe(true);
  });

  it("submit() returns true when all fields validate successfully", () => {
    const { submit, formState } = setupFormState();
    const f1 = mockField("name", { validate: vi.fn(() => true) });
    const f2 = mockField("age", { validate: vi.fn(() => true) });
    formState.register(f1.id, f1.registration);
    formState.register(f2.id, f2.registration);

    expect(submit()).toBe(true);
  });

  it("submit() returns error array when a field fails validation", () => {
    const { submit, formState } = setupFormState();
    const f1 = mockField("email", { validate: vi.fn(() => "Required") });
    formState.register(f1.id, f1.registration);

    const result = submit();
    expect(result).toEqual([{ path: "email", message: "Required" }]);
  });

  it("submit() returns true immediately when firstValidation is 'none'", () => {
    const { submit, formState } = setupFormState({
      firstValidation: ref("none"),
    });
    // Register a field that would fail
    const f1 = mockField("email", { validate: vi.fn(() => "Required") });
    formState.register(f1.id, f1.registration);

    expect(submit()).toBe(true);
    // validate should NOT have been called
    expect(f1.registration.callbacks.validate).not.toHaveBeenCalled();
  });

  it("submit() uses submitValidator when provided", () => {
    const submitValidator = vi.fn(() => ({ email: "Bad email" }));
    const { submit, formState } = setupFormState({ submitValidator });

    // Register a field so we can verify per-field validate is NOT called
    const f1 = mockField("email", { validate: vi.fn(() => true) });
    formState.register(f1.id, f1.registration);

    const result = submit();
    expect(submitValidator).toHaveBeenCalled();
    expect(f1.registration.callbacks.validate).not.toHaveBeenCalled();
    expect(result).toEqual([{ path: "email", message: "Bad email" }]);
  });

  it("submit() with submitValidator returning {} means valid", () => {
    const submitValidator = vi.fn(() => ({}));
    const { submit } = setupFormState({ submitValidator });

    expect(submit()).toBe(true);
  });

  // ── clearErrors ───────────────────────────────────────────

  it("clearErrors() resets firstSubmitHappened to false", () => {
    const { submit, clearErrors, formState } = setupFormState();
    submit();
    expect(formState.firstSubmitHappened).toBe(true);
    clearErrors();
    expect(formState.firstSubmitHappened).toBe(false);
  });

  it("clearErrors() calls clearErrors on all registered field callbacks", () => {
    const { clearErrors, formState } = setupFormState();
    const f1 = mockField("name");
    const f2 = mockField("age");
    formState.register(f1.id, f1.registration);
    formState.register(f2.id, f2.registration);

    clearErrors();
    expect(f1.registration.callbacks.clearErrors).toHaveBeenCalledOnce();
    expect(f2.registration.callbacks.clearErrors).toHaveBeenCalledOnce();
  });

  // ── reset ─────────────────────────────────────────────────

  it("reset() calls reset on all fields then clears errors", async () => {
    const order: string[] = [];
    const { reset, formState } = setupFormState();

    const f1 = mockField("name", {
      reset: vi.fn(() => order.push("reset:name")),
      clearErrors: vi.fn(() => order.push("clear:name")),
    });
    const f2 = mockField("age", {
      reset: vi.fn(() => order.push("reset:age")),
      clearErrors: vi.fn(() => order.push("clear:age")),
    });
    formState.register(f1.id, f1.registration);
    formState.register(f2.id, f2.registration);

    await reset();

    // reset called on both, then clearErrors called on both (after nextTick)
    expect(f1.registration.callbacks.reset).toHaveBeenCalledOnce();
    expect(f2.registration.callbacks.reset).toHaveBeenCalledOnce();
    expect(f1.registration.callbacks.clearErrors).toHaveBeenCalledOnce();
    expect(f2.registration.callbacks.clearErrors).toHaveBeenCalledOnce();

    // resets happen before clears
    const firstResetIdx = order.findIndex((s) => s.startsWith("reset:"));
    const firstClearIdx = order.findIndex((s) => s.startsWith("clear:"));
    expect(firstResetIdx).toBeLessThan(firstClearIdx);
  });

  // ── setErrors ─────────────────────────────────────────────

  it("setErrors() propagates path->message to registered fields", () => {
    const { setErrors, formState } = setupFormState();
    const f1 = mockField("email");
    const f2 = mockField("name");
    formState.register(f1.id, f1.registration);
    formState.register(f2.id, f2.registration);

    setErrors({ email: "Invalid email" });

    expect(f1.registration.callbacks.setExternalError).toHaveBeenCalledWith("Invalid email");
    // name was not in the errors map -> receives undefined
    expect(f2.registration.callbacks.setExternalError).toHaveBeenCalledWith(undefined);
  });

  it("setErrors() passes undefined for unmatched paths", () => {
    const { setErrors, formState } = setupFormState();
    const f1 = mockField("phone");
    formState.register(f1.id, f1.registration);

    setErrors({ email: "Bad" });

    expect(f1.registration.callbacks.setExternalError).toHaveBeenCalledWith(undefined);
  });

  // ── unregister ────────────────────────────────────────────

  it("unregistered fields are excluded from submit validation", () => {
    const { submit, formState } = setupFormState();
    const f1 = mockField("email", { validate: vi.fn(() => "Required") });
    formState.register(f1.id, f1.registration);
    formState.unregister(f1.id);

    expect(submit()).toBe(true);
    expect(f1.registration.callbacks.validate).not.toHaveBeenCalled();
  });

  it("unregistered fields don't receive clearErrors", () => {
    const { clearErrors, formState } = setupFormState();
    const f1 = mockField("name");
    formState.register(f1.id, f1.registration);
    formState.unregister(f1.id);

    clearErrors();
    expect(f1.registration.callbacks.clearErrors).not.toHaveBeenCalled();
  });
});
