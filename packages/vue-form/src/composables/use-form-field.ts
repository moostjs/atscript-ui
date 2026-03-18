import { computed, inject, onUnmounted, ref, watch, type ComputedRef } from "vue";
import type { TFormRule, TFormState } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UseFormFieldOptions<TValue = any, TFormData = any, TContext = any> {
  getValue: () => TValue;
  setValue: (v: TValue) => void;
  rules?: TFormRule<TValue, TFormData, TContext>[];
  path: () => string;
  /** Value to set on reset. Defaults to `''`. Use `[]` for arrays, `{}` for objects. */
  resetValue?: TValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormField<TValue = any, TFormData = any, TContext = any>(
  opts: UseFormFieldOptions<TValue, TFormData, TContext>,
) {
  const formState = inject<TFormState>("__as_form");
  const formData = inject<ComputedRef<TFormData | undefined>>("__as_form_data");
  const formContext = inject<ComputedRef<TContext | undefined>>("__as_form_context");

  const id = Symbol("form-field");
  const submitError = ref<string>();
  const externalError = ref<string>();
  const touched = ref(false);
  const blur = ref(false);

  const model = computed<TValue>({
    get: opts.getValue,
    set: opts.setValue,
  });

  watch(
    model,
    () => {
      submitError.value = undefined;
      externalError.value = undefined;
      touched.value = true;
    },
    {},
  );

  const isValidationActive = computed(() => {
    if (!formState?.firstValidation) return false;
    switch (formState.firstValidation) {
      case "on-change":
        return formState.firstSubmitHappened || touched.value;
      case "touched-on-blur":
        return formState.firstSubmitHappened || (blur.value && touched.value);
      case "on-blur":
        return formState.firstSubmitHappened || blur.value;
      case "on-submit":
        return formState.firstSubmitHappened;
      default:
        return false;
    }
  });

  function validate(): string | undefined {
    if (opts.rules?.length) {
      for (const rule of opts.rules) {
        const result = rule(
          model.value as TValue,
          formData?.value as TFormData,
          formContext?.value as TContext,
        );
        if (result !== true) {
          return (result as string) || "Wrong value";
        }
      }
    }
    return undefined;
  }

  const error = computed<string | undefined>(() => {
    if (externalError.value) return externalError.value;
    // Return submitError directly — validate() already ran during the submit callback,
    // calling it again here would double-validate every field on every submit.
    if (submitError.value) return submitError.value;
    if (isValidationActive.value) {
      return validate();
    }
    return undefined;
  });

  function onBlur() {
    blur.value = true;
  }

  // Register with form
  if (formState) {
    formState.register(id, {
      path: opts.path,
      callbacks: {
        validate: () => {
          submitError.value = validate();
          return submitError.value || true;
        },
        clearErrors: () => {
          touched.value = false;
          blur.value = false;
          submitError.value = undefined;
          externalError.value = undefined;
        },
        reset: () => {
          model.value = (opts.resetValue ?? "") as TValue;
        },
        setExternalError: (msg?: string) => {
          externalError.value = msg;
        },
      },
    });
  }

  onUnmounted(() => {
    formState?.unregister(id);
  });

  return { model, error, onBlur };
}
