import {
  computed,
  inject,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type WritableComputedRef,
} from "vue";
import { FORM_CONTEXT_KEY, FORM_DATA_KEY, FORM_PATCH_KEY, FORM_STATE_KEY } from "./internal-keys";
import type { TFormRule } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UseAsFieldOptions<TValue = any, TFormData = any, TContext = any> {
  getValue: () => TValue;
  setValue: (v: TValue) => void;
  rules?: TFormRule<TValue, TFormData, TContext>[];
  path: () => string;
  /** Value to set on reset. Defaults to `''`. Use `[]` for arrays, `{}` for objects. */
  resetValue?: TValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UseAsFieldReturn<TValue = any> {
  model: WritableComputedRef<TValue>;
  error: ComputedRef<string | undefined>;
  onBlur: () => void;
  /**
   * Reactive "changed-since-baseline" flag for THIS field. `true` when the
   * form has `track-changes` enabled AND the field at `opts.path()` differs
   * from the tracker's baseline. Recomputes whenever the change list does
   * (delegates to the injected {@link AsFormPatchHandle.isDirtyPath}).
   *
   * Always `false` when tracking is off (no patch handle injected) — the
   * handle is injected OPTIONALLY, so reading `isDirty` never throws.
   * Granularity matches the change list: object/section containers light up
   * via their leaves' prefix, whole-array fields via exact match; an
   * array-ITEM leaf stays `false` (the array container lights up instead).
   */
  isDirty: ComputedRef<boolean>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAsField<TValue = any, TFormData = any, TContext = any>(
  opts: UseAsFieldOptions<TValue, TFormData, TContext>,
): UseAsFieldReturn<TValue> {
  const formState = inject(FORM_STATE_KEY);
  const formData = inject(FORM_DATA_KEY) as ComputedRef<TFormData | undefined> | undefined;
  const formContext = inject(FORM_CONTEXT_KEY) as ComputedRef<TContext | undefined> | undefined;
  // OPTIONAL inject — absent when `track-changes` is off. Must NOT use
  // `useAsFormPatch()` here (it THROWS when tracking is disabled); a plain
  // `inject(..., undefined)` keeps OFF a silent, zero-cost "never dirty".
  const patch = inject(FORM_PATCH_KEY, undefined);

  const id = Symbol("form-field");
  const submitError = ref<string>();
  const externalError = ref<string>();
  const touched = ref(false);
  const blur = ref(false);

  const model = computed<TValue>({
    get: opts.getValue,
    set: opts.setValue,
  });

  // Per-field dirty flag. `opts.path()` is the FULL dot-path in the same
  // path-space as `FormFieldChange.path` (the same path registered with
  // `formState` for error mapping), so it feeds the predicate directly.
  // `false` when tracking is off (no handle). Reading `patch.isDirtyPath`
  // touches the reactive change list, so this recomputes on every change.
  const isDirty = computed<boolean>(() => (patch ? patch.isDirtyPath(opts.path()) : false));

  watch(
    model,
    () => {
      submitError.value = undefined;
      externalError.value = undefined;
      touched.value = true;
      // Editing a fresh field promotes it: it now participates in live
      // validation like any field that existed at submit time.
      formState?.freshFields.delete(id);
    },
    {},
  );

  const isValidationActive = computed(() => {
    if (!formState?.firstValidation) return false;
    if (formState.freshFields.has(id)) return false;
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
    // Tabbing past a fresh field counts as "considered" — promote it out of
    // freshness so its error surfaces. Without this, a user can tab through
    // an entire newly-added array item and never see its required-field
    // errors until they either type into one or submit again.
    formState?.freshFields.delete(id);
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

  return { model, error, onBlur, isDirty };
}
