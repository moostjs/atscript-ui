import {
  computed,
  provide,
  ref,
  toRaw,
  watch,
  type Component,
  type ComputedRef,
  type Ref,
} from "vue";
import {
  buildDescendantErrorCounts,
  getFieldMeta,
  getFormValidator,
  iteratePathAncestors,
  mergeErrorMaps,
  resolveFieldProp,
  resolveFormProp,
  META_DESCRIPTION,
  META_LABEL,
  UI_FORM_ACTION,
  UI_FORM_FN_DESCRIPTION,
  UI_FORM_FN_SUBMIT_DISABLED,
  UI_FORM_FN_SUBMIT_TEXT,
  UI_FORM_FN_TITLE,
  UI_FORM_SUBMIT_TEXT,
  WF_ACTION_WITH_DATA,
  type ClientFactory,
  type FormDef,
} from "@atscript/ui";
import type { TFnScope } from "@atscript/ui-fns";
import {
  ACTION_HANDLER_KEY,
  CHANGE_HANDLER_KEY,
  COMPONENTS_KEY,
  DISMISS_EXTERNAL_AT_KEY,
  ERRORS_KEY,
  HIDE_ROOT_TITLE_KEY,
  PATH_PREFIX_KEY,
  ROOT_DATA_KEY,
  TYPES_KEY,
} from "./internal-keys";
import {
  DESCENDANT_ERROR_COUNTS_KEY,
  provideAsNestedSectionsStore,
  useAsNestedSectionsStore,
} from "./use-as-nested-sections-store";
import { CLIENT_FACTORY_KEY } from "./use-as-value-help";
import { useAsExternalErrors } from "./use-as-external-errors";
import { useAsState } from "./use-as-state";
import type { TFormState } from "./types";
import type { TAsChangeType, TAsComponentProps, TAsTypeComponents } from "../components/types";

/**
 * Discriminated change type emitted by the form's `onChange` callback.
 * Re-exported for convenience; same shape as the `change` event from `<AsForm>`.
 */
export type { TAsChangeType };

/**
 * Options for {@link useAsForm}. Each reactive prop is supplied as a
 * **getter** so the composable can subscribe to its changes without owning
 * a `Ref`. Pass component-level `defineProps` accessors verbatim:
 *
 * ```ts
 * useAsForm({
 *   def: () => props.def,
 *   formData: () => props.formData,
 *   types: () => props.types,
 *   // ...
 *   emits: { submit: (data) => emit("submit", data), ... },
 * })
 * ```
 *
 * Generic `TFormData` / `TFormContext` mirror the `<AsForm>` component
 * generics. They flow through to emitted callbacks; if you build a custom
 * form root with a known data shape, pin them at the call site.
 */
export interface UseAsFormOptions<TFormData = unknown, TFormContext = unknown> {
  /** Form definition produced by `createAsFormDef(type)`. Reactive. */
  def: () => FormDef;
  /**
   * Externally-managed form data container `{ value: domainData }`. When
   * unset, the composable creates an internal one initialized to `{}`.
   */
  formData?: () => TFormData | undefined;
  /** Reactive form context — exposed to validators, scope, slots, and emits. */
  formContext?: () => TFormContext | undefined;
  /** First-validation strategy. Defaults to `"on-change"`. */
  firstValidation?: () => TFormState["firstValidation"] | undefined;
  /** Custom field components keyed by field name (matches `Props.components`). */
  components?: () => Record<string, Component<TAsComponentProps>> | undefined;
  /** Type-to-component map keyed by field type (matches `Props.types`). */
  types: () => TAsTypeComponents;
  /** Server-supplied errors keyed by absolute dotted path (`__form` for form-level). */
  errors?: () => Record<string, string | undefined> | undefined;
  /** Per-form value-help client factory. Falls back to the app-wide default when unset. */
  clientFactory?: () => ClientFactory | undefined;
  /** Suppress the root field's title (use when the chrome already shows the form's label). */
  hideRootTitle?: () => boolean | undefined;
  /**
   * Busy-state flag. When `true`, the form is locked (inert + overlay) and the
   * default submit button is disabled. `<AsWfForm>` wires this to its
   * server round-trip so consumers can drop their own submit overrides.
   */
  loading?: () => boolean | undefined;

  /**
   * Outbound callbacks. Customer form roots typically wire these to
   * `defineEmits`; advanced uses can pass plain functions.
   */
  emits?: {
    submit?: (data: TFormData) => void;
    error?: (errors: { path: string; message: string }[]) => void;
    action?: (name: string, data: TFormData) => void;
    unsupportedAction?: (name: string, data: TFormData) => void;
    change?: (type: TAsChangeType, path: string, value: unknown, formData: TFormData) => void;
  };
}

export interface UseAsFormReturn<TFormData = unknown, TFormContext = unknown> {
  /** Reactive form-data container `{ value: domainData }`. */
  data: ComputedRef<TFormData>;
  /** Effective external errors (post-dismissal), excluding `__form`. */
  errors: ComputedRef<Record<string, string | undefined> | undefined>;
  /** Form-level error message (post banner-dismissal). */
  formError: ComputedRef<string | undefined>;
  /** Errors discovered by the local validator on the most-recent submit. */
  internalErrors: Ref<Record<string, string>>;
  /** Reset internal validator + dismissal state and re-run field defaults. */
  reset: () => Promise<void>;
  /** Imperatively clear errors (matches `useAsState().clearErrors`). */
  clearErrors: () => void;
  /** Imperatively set external-error messages by path. */
  setErrors: (errors: Record<string, string>) => void;
  /** Trigger submit. Emits `submit` on success and `error` on validation failure. */
  onSubmit: () => void;
  /** Resolved submit-button text (`@ui.form.submit.text` / fn variant). */
  submitText: ComputedRef<string>;
  /** Resolved submit-button disabled state (`@ui.form.fn.submitDisabled`). */
  submitDisabled: ComputedRef<boolean>;
  /** Resolved form-level title (`@ui.form.fn.title` / `@meta.label`); may be `undefined`. */
  title: ComputedRef<string | undefined>;
  /** Resolved form-level description (`@ui.form.fn.description` / `@meta.description`). */
  description: ComputedRef<string | undefined>;
  /** Unified slot-props bag spread onto every `<AsForm>` slot. */
  slotProps: ComputedRef<{
    title: string | undefined;
    description: string | undefined;
    data: TFormData;
    errors: Record<string, string | undefined> | undefined;
    formError: string | undefined;
    disabled: boolean;
    loading: boolean;
    submitText: string;
    submit: () => void;
    reset: () => Promise<void>;
    clearErrors: () => void;
    setErrors: (errors: Record<string, string>) => void;
    dismissError: (path: string) => void;
    dismissFormError: () => void;
    formContext: TFormContext | undefined;
  }>;
  /** Dispatch an action — invoked by `<AsAction>`. */
  invokeAction: (name: string) => void;
  /** Dismiss a single external leaf error. */
  dismissError: (path: string) => void;
  /** Dismiss the form-level banner. */
  dismissFormError: () => void;
  /** Form-context getter (mirrors `options.formContext()`). */
  formContext: ComputedRef<TFormContext | undefined>;
  /** Internal change-dispatcher used by `<AsField>` and structured components. */
  handleChange: (type: TAsChangeType, path: string, value: unknown) => void;
}

/**
 * Composable backing `<AsForm>`. Owns the entire form state machine —
 * data container, internal validator, external-error dismissal, action
 * routing, change merging, descendant counts, auto-open, and all
 * provide/inject wiring. Customers building a custom form root can
 * call this directly and render their own `<form>` template.
 *
 * MUST be called from a component's `<script setup>` (it issues
 * `provide()` calls that need an active component instance).
 */
export function useAsForm<TFormData = unknown, TFormContext = unknown>(
  options: UseAsFormOptions<TFormData, TFormContext>,
): UseAsFormReturn<TFormData, TFormContext> {
  // ── Data container ───────────────────────────────────────────
  const _data = ref<TFormData>({} as TFormData);
  const data = computed<TFormData>(() => {
    const ext = options.formData?.();
    return (ext ?? (_data.value as TFormData)) as TFormData;
  });

  /**
   * Unwraps domain data from the form data container. Form data is
   * `{ value: domainData }` — getByPath/setByPath handle this wrapper
   * automatically, but scope/validator callers need the inner value.
   */
  function getDomainData(): Record<string, unknown> {
    return (data.value as Record<string, unknown>).value as Record<string, unknown>;
  }
  const domainData = () => toRaw(getDomainData()) as TFormData;

  const formContext = computed<TFormContext | undefined>(() => options.formContext?.());

  // ── Full-type validator (created once per def, called per-submit) ──
  // Override the default `errorLimit: 10` from `@atscript/typescript` so
  // AsObject's count badges reflect every nested error on a large form.
  const formValidator = computed(() =>
    getFormValidator(options.def(), { errorLimit: Number.MAX_SAFE_INTEGER }),
  );

  // ── Form state composable (also publishes FORM_STATE_KEY etc.) ──
  const {
    clearErrors,
    reset: resetState,
    submit,
    setErrors,
  } = useAsState({
    formData: data,
    formContext,
    firstValidation: computed(() => options.firstValidation?.()),
    submitValidator: () =>
      formValidator.value({
        data: getDomainData(),
        context: (formContext.value ?? {}) as Record<string, unknown>,
      }),
  });

  // ── Provides — root data, prefix, type/component maps ───────
  provide(ROOT_DATA_KEY, data);
  provide(
    PATH_PREFIX_KEY,
    computed(() => ""),
  );
  provide(
    TYPES_KEY,
    computed(() => options.types()),
  );
  provide(
    COMPONENTS_KEY,
    computed(() => options.components?.()),
  );
  provide(HIDE_ROOT_TITLE_KEY, options.hideRootTitle?.() === true);

  // ── External errors with dismissal state ────────────────────
  const ext = useAsExternalErrors({ source: () => options.errors?.() });
  provide(ERRORS_KEY, ext.effective);
  provide(DISMISS_EXTERNAL_AT_KEY, ext.dismissAt);

  // Provide the collapsible-section store only if a parent hasn't already
  // supplied one — a page that wants to drive Expand-all / Collapse-all UI
  // calls `provideAsNestedSectionsStore()` *above* `<AsForm>`, and the form
  // inherits that shared store instead of creating its own.
  const sectionsStore = useAsNestedSectionsStore() ?? provideAsNestedSectionsStore();
  const cf = options.clientFactory?.();
  if (cf) provide(CLIENT_FACTORY_KEY, cf);

  // External (post-dismissal) + internal validation merged into a single
  // map. Drives both the descendant-count badges and the auto-open watcher.
  const internalErrors = ref<Record<string, string>>({});
  const allErrors = computed(() => mergeErrorMaps(ext.effective.value, internalErrors.value));

  const descendantErrorCounts = computed(() => buildDescendantErrorCounts(allErrors.value));
  provide(DESCENDANT_ERROR_COUNTS_KEY, descendantErrorCounts);

  // Auto-open every ancestor of an error path so the user sees the invalid
  // field immediately, instead of a collapsed section with a count badge.
  watch(
    allErrors,
    (errors) => {
      for (const errPath of Object.keys(errors)) {
        for (const ancestor of iteratePathAncestors(errPath)) {
          sectionsStore.setOpen(ancestor, true);
        }
      }
    },
    { immediate: true, flush: "post" },
  );

  // ── Form-level resolved props ──────────────────────────────
  // Widen `TFnScope` to `Record<string, unknown>` for the resolver boundary —
  // ui-fns' DynamicFieldResolver does the same cast internally; the static
  // resolver ignores the scope entirely.
  // `v` mirrors the root field's value, which IS the domain data — root-level
  // `@ui.form.fn.*` strings are field fns whose first arg is the field value,
  // so `(data) => data.firstName` on the interface receives the form data.
  // Top-level fns (`submit.text` / `submit.disabled`) ignore `v` entirely.
  const ctx = computed<Record<string, unknown>>(
    () =>
      ({
        v: getDomainData(),
        data: getDomainData(),
        context: (formContext.value ?? {}) as Record<string, unknown>,
        entry: undefined,
      }) satisfies TFnScope as unknown as Record<string, unknown>,
  );

  const submitText = computed(
    () =>
      resolveFormProp<string>(
        options.def().type,
        UI_FORM_FN_SUBMIT_TEXT,
        UI_FORM_SUBMIT_TEXT,
        ctx.value,
      ) ?? "Submit",
  );
  const submitDisabled = computed(
    () =>
      options.loading?.() === true ||
      (resolveFormProp<boolean>(
        options.def().type,
        UI_FORM_FN_SUBMIT_DISABLED,
        undefined,
        ctx.value,
      ) ??
        false),
  );

  // ── Form-level title / description (root field, fn-aware) ──
  // Mirror as-field.vue's resolution but WITHOUT the field-name fallback:
  // a form header title may legitimately be undefined.
  const resolveRootProp = (fnKey: string, staticKey: string): string | undefined => {
    const root = options.def().rootField;
    return root ? resolveFieldProp<string>(root.prop, fnKey, staticKey, ctx.value) : undefined;
  };
  const title = computed(() => resolveRootProp(UI_FORM_FN_TITLE, META_LABEL));
  const description = computed(() => resolveRootProp(UI_FORM_FN_DESCRIPTION, META_DESCRIPTION));

  // ── Unified slot-props bag ─────────────────────────────────
  // The single bag every `<AsForm>` slot receives (spread via `v-bind`).
  // Reactive computeds are unwrapped to plain values; function references
  // pass through as-is.
  const slotProps = computed(() => ({
    title: title.value,
    description: description.value,
    data: data.value,
    errors: ext.effective.value,
    formError: ext.formError.value,
    disabled: submitDisabled.value,
    loading: options.loading?.() === true,
    submitText: submitText.value,
    submit: onSubmit,
    reset: resetState,
    clearErrors,
    setErrors,
    dismissError: ext.dismissAt,
    dismissFormError: ext.dismissForm,
    formContext: formContext.value,
  }));

  // ── Action handler (provided to AsField tree) ──────────────
  function supportsAction(def: FormDef, actionId: string): boolean {
    return def.fields.some((f) => {
      const a = getFieldMeta(f.prop, UI_FORM_ACTION);
      if (a?.id === actionId) return true;
      return getFieldMeta(f.prop, WF_ACTION_WITH_DATA) === actionId;
    });
  }

  function invokeAction(name: string) {
    if (supportsAction(options.def(), name)) {
      options.emits?.action?.(name, domainData());
    } else {
      options.emits?.unsupportedAction?.(name, domainData());
    }
  }
  provide(ACTION_HANDLER_KEY, invokeAction);

  // ── Change handler — propagates dismissal + drops stale internal errors ──
  function handleChange(type: TAsChangeType, path: string, value: unknown) {
    // Covers programmatic value commits (union-switch, array-add) that
    // bypass the leaf model watcher's per-keystroke dismissal.
    ext.dismissAt(path);
    // Field-local watches clear scalar errors on direct edits, but a parent
    // struct/array error never sees a model identity change when a child
    // mutates — so drop the changed path + ancestors here. Next submit
    // re-validates.
    const errors = internalErrors.value;
    let stale: Set<string> | null = null;
    let next: Record<string, string> | null = null;
    for (const key in errors) {
      if (!stale) stale = new Set(iteratePathAncestors(path));
      if (stale.has(key)) {
        if (!next) next = { ...errors };
        delete next[key];
      }
    }
    if (next) {
      internalErrors.value = next;
      setErrors(next);
    }
    options.emits?.change?.(type, path, value, domainData());
  }
  provide(CHANGE_HANDLER_KEY, handleChange);

  // ── Submit ────────────────────────────────────────────────
  function onSubmit() {
    const result = submit();
    if (result === true) {
      internalErrors.value = {};
      options.emits?.submit?.(domainData());
    } else {
      const errs: Record<string, string> = {};
      for (const e of result) errs[e.path] = e.message;
      internalErrors.value = errs;
      options.emits?.error?.(result);
    }
  }

  return {
    data,
    errors: ext.effective,
    formError: ext.formError,
    internalErrors,
    reset: resetState,
    clearErrors,
    setErrors,
    onSubmit,
    submitText,
    submitDisabled,
    title,
    description,
    slotProps,
    invokeAction,
    dismissError: ext.dismissAt,
    dismissFormError: ext.dismissForm,
    formContext,
    handleChange,
  };
}
