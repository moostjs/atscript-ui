import { computed, nextTick, provide, reactive, toValue, watchEffect, type MaybeRef } from "vue";
import type { TFormFieldRegistration, TFormState } from "./types";

/** Custom form-level validator. Returns `Record<path, message>` (empty = passed). */
export type TFormSubmitValidator = () => Record<string, string>;

export function useFormState<TFormData, TContext>(opts: {
  formData: MaybeRef<TFormData>;
  formContext?: MaybeRef<TContext>;
  firstValidation?: MaybeRef<TFormState["firstValidation"] | undefined>;
  /** When provided, replaces per-field iteration on submit. */
  submitValidator?: TFormSubmitValidator;
}) {
  const fieldsById = new Map<symbol, TFormFieldRegistration>();

  // Stable functions — outside computed to avoid re-creation on reactivity ticks
  const register = (id: symbol, registration: TFormFieldRegistration) => {
    fieldsById.set(id, registration);
  };
  const unregister = (id: symbol) => {
    fieldsById.delete(id);
  };

  // Reactive object — properties are mutated in-place so Vue's fine-grained
  // reactivity only invalidates dependents that read the specific changed property
  // (e.g. firstSubmitHappened), instead of every consumer on every tick.
  const formState = reactive<TFormState>({
    firstSubmitHappened: false,
    firstValidation: toValue(opts.firstValidation) ?? "on-change",
    register,
    unregister,
  });

  // Sync firstValidation from opts (may be a ref)
  watchEffect(() => {
    const v = toValue(opts.firstValidation) ?? "on-change";
    if (formState.firstValidation !== v) formState.firstValidation = v;
  });

  provide("__as_form", formState);
  provide(
    "__as_form_data",
    computed(() => toValue(opts.formData)),
  );
  provide(
    "__as_form_context",
    computed(() => (opts.formContext ? toValue(opts.formContext) : undefined)),
  );

  function clearErrors() {
    formState.firstSubmitHappened = false;
    for (const reg of fieldsById.values()) {
      reg.callbacks.clearErrors();
    }
  }

  async function reset() {
    for (const reg of fieldsById.values()) {
      reg.callbacks.reset();
    }
    await nextTick();
    clearErrors();
  }

  function submit(): true | { path: string; message: string }[] {
    formState.firstSubmitHappened = true;
    if (formState.firstValidation === "none") return true;

    // Custom form-level validator — replaces per-field iteration
    if (opts.submitValidator) {
      const errors = opts.submitValidator();
      const entries = Object.entries(errors);
      if (entries.length === 0) return true;
      setErrors(errors);
      return entries.map(([path, message]) => ({ path, message }));
    }

    // Fallback: per-field iteration
    const errors: { path: string; message: string }[] = [];
    for (const reg of fieldsById.values()) {
      const result = reg.callbacks.validate();
      if (result !== true) {
        const path = reg.path();
        errors.push({ path, message: result as string });
      }
    }
    return errors.length > 0 ? errors : true;
  }

  function setErrors(errors: Record<string, string>) {
    for (const reg of fieldsById.values()) {
      const p = reg.path();
      reg.callbacks.setExternalError(errors[p]);
    }
  }

  return { clearErrors, reset, submit, setErrors, formState };
}
