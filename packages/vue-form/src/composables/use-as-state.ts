import {
  computed,
  nextTick,
  provide,
  reactive,
  shallowRef,
  toValue,
  watchEffect,
  type ComputedRef,
  type MaybeRef,
} from "vue";
import { FORM_CONTEXT_KEY, FORM_DATA_KEY, FORM_STATE_KEY } from "./internal-keys";
import type { TFormFieldRegistration, TFormState } from "./types";

/** Custom form-level validator. Returns `Record<path, message>` (empty = passed). */
export type TFormSubmitValidator = () => Record<string, string>;

export interface UseAsStateReturn {
  formState: TFormState;
  clearErrors: () => void;
  reset: () => Promise<void>;
  submit: () => true | { path: string; message: string }[];
  setErrors: (errors: Record<string, string>) => void;
  /**
   * What every registered field DISPLAYS right now, keyed by path
   * (`callbacks.getError` per field; fields without the callback are
   * skipped). Recomputes when any field's displayed error changes and on
   * register/unregister — the live source for error-count badges.
   */
  liveErrors: ComputedRef<Record<string, string>>;
  /** Paths of all currently registered (mounted) fields. */
  registeredPaths: ComputedRef<Set<string>>;
}

export function useAsState<TFormData, TContext>(opts: {
  formData: MaybeRef<TFormData>;
  formContext?: MaybeRef<TContext>;
  firstValidation?: MaybeRef<TFormState["firstValidation"] | undefined>;
  /** When provided, replaces per-field iteration on submit. */
  submitValidator?: TFormSubmitValidator;
}): UseAsStateReturn {
  const fieldsById = new Map<symbol, TFormFieldRegistration>();
  // Bumped on register/unregister so the aggregation computeds below see
  // mounts/unmounts. `fieldsById` itself stays a plain Map — per-edit
  // reactivity flows through each field's `getError`/`path` (cached computed
  // reads), not through Map mutation.
  const fieldsRevision = shallowRef(0);

  // Stable functions — outside computed to avoid re-creation on reactivity ticks
  const register = (id: symbol, registration: TFormFieldRegistration) => {
    fieldsById.set(id, registration);
    fieldsRevision.value++;
    // Fields mounted after the first failed submit start "fresh": live
    // validation stays suppressed until the user edits the field or the
    // next submit fires. Without this, a newly-added array item lights up
    // every required field in red the moment it's rendered.
    if (formState.firstSubmitHappened) {
      formState.freshFields.add(id);
    }
  };
  const unregister = (id: symbol) => {
    fieldsById.delete(id);
    fieldsRevision.value++;
    formState.freshFields.delete(id);
  };

  // Reactive object — properties are mutated in-place so Vue's fine-grained
  // reactivity only invalidates dependents that read the specific changed property
  // (e.g. firstSubmitHappened), instead of every consumer on every tick.
  const formState = reactive<TFormState>({
    firstSubmitHappened: false,
    firstValidation: toValue(opts.firstValidation) ?? "on-change",
    freshFields: new Set<symbol>(),
    register,
    unregister,
  });

  // Sync firstValidation from opts (may be a ref)
  watchEffect(() => {
    const v = toValue(opts.firstValidation) ?? "on-change";
    if (formState.firstValidation !== v) formState.firstValidation = v;
  });

  provide(FORM_STATE_KEY, formState);
  provide(
    FORM_DATA_KEY,
    computed(() => toValue(opts.formData)),
  );
  provide(
    FORM_CONTEXT_KEY,
    computed(() => (opts.formContext ? toValue(opts.formContext) : undefined)),
  );

  function clearErrors() {
    formState.firstSubmitHappened = false;
    formState.freshFields.clear();
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
    // A submit applies to every currently-registered field — they're no
    // longer "fresh" past this point, regardless of whether validation
    // passes or fails.
    formState.freshFields.clear();
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

  // What every mounted field displays right now. Reading `getError()` inside
  // the computed subscribes it to each field's cached error computed, so it
  // recomputes exactly when a display changes (and on mount/unmount via the
  // revision). Two registrations on one path (e.g. a custom field adding a
  // rule beside its AsField) collapse to one entry — the badge counts paths,
  // not rules, and an erroring path counts once either way.
  const liveErrors = computed<Record<string, string>>(() => {
    void fieldsRevision.value;
    const errors: Record<string, string> = {};
    for (const reg of fieldsById.values()) {
      const msg = reg.callbacks.getError?.();
      if (msg) errors[reg.path()] = msg;
    }
    return errors;
  });

  // `path()` reads each field's (reactive) absolute path, so the set also
  // tracks path changes (array reorders), not just mounts/unmounts.
  const registeredPaths = computed<Set<string>>(() => {
    void fieldsRevision.value;
    const paths = new Set<string>();
    for (const reg of fieldsById.values()) {
      paths.add(reg.path());
    }
    return paths;
  });

  return { clearErrors, reset, submit, setErrors, formState, liveErrors, registeredPaths };
}
