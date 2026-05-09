<script setup lang="ts" generic="TFormData = any, TFormContext = any">
import { useFormState } from "../composables/use-form-state";
import {
  ACTION_HANDLER_KEY,
  CHANGE_HANDLER_KEY,
  COMPONENTS_KEY,
  ERRORS_KEY,
  HIDE_ROOT_TITLE_KEY,
  PATH_PREFIX_KEY,
  ROOT_DATA_KEY,
  TYPES_KEY,
} from "../composables/internal-keys";
import {
  DESCENDANT_ERROR_COUNTS_KEY,
  provideNestedSectionsStore,
  useNestedSectionsStore,
} from "../composables/use-nested-sections";
import type { TFormState } from "../composables/types";
import AsField from "./as-field.vue";
import type { FormDef, ClientFactory } from "@atscript/ui";
import {
  buildDescendantErrorCounts,
  getFormValidator,
  iteratePathAncestors,
  mergeErrorMaps,
  resolveFormProp,
  getFieldMeta,
  WF_ACTION_WITH_DATA,
  UI_FORM_ACTION,
  UI_FORM_FN_SUBMIT_DISABLED,
  UI_FORM_FN_SUBMIT_TEXT,
  UI_FORM_SUBMIT_TEXT,
} from "@atscript/ui";
import { CLIENT_FACTORY_KEY } from "../composables/use-value-help";
import type { TFnScope } from "@atscript/ui-fns";
import { computed, provide, ref, toRaw, watch, type Component } from "vue";
import type { TAsChangeType, TAsComponentProps, TAsTypeComponents } from "./types";

export interface Props<TF, TC> {
  def: FormDef;
  formData?: TF;
  formContext?: TC;
  firstValidation?: TFormState["firstValidation"];
  components?: Record<string, Component<TAsComponentProps>>;
  /**
   * Type-to-component map for field rendering. Maps field types to Vue components.
   * Must include entries for all built-in field types. Use `createDefaultTypes()`
   * for a pre-filled map, or supply your own.
   */
  types: TAsTypeComponents;
  errors?: Record<string, string | undefined>;
  /**
   * Per-form client factory override. Creates `Client` instances from URL paths
   * for FK value-help pickers inside this form. Falls back to the app-wide
   * default (`setDefaultClientFactory`) and then to the built-in `new Client(url)`
   * factory when unset.
   */
  clientFactory?: ClientFactory;
  /**
   * Suppress the root field's title rendering. Use when the form is mounted
   * inside a chrome that already shows the form's `@meta.label` (e.g. a
   * dialog header). Nested fields keep their own headings.
   */
  hideRootTitle?: boolean;
  /**
   * Suppress the default submit button. Use when the host chrome owns the
   * submit affordance (e.g. a dialog footer with its own submit button
   * wired via HTML5 `<button form="...">`). Vue 3 treats an empty
   * `<template #form.submit />` as "slot not provided" and falls back to
   * the default button — this prop is the explicit way to skip it.
   */
  hideSubmit?: boolean;
}

const props = defineProps<Props<TFormData, TFormContext>>();

const _data = ref<TFormData>({} as TFormData);
const data = computed<TFormData>(() => props.formData || (_data.value as TFormData));

/**
 * Unwraps domain data from the form data container.
 * Form data is `{ value: domainData }` — getByPath/setByPath handle this
 * wrapper automatically, but scope/validator callers need the inner value.
 */
function getDomainData(): Record<string, unknown> {
  return (data.value as Record<string, unknown>).value as Record<string, unknown>;
}

// ── Full-type validator (created once per def, called per-submit) ──
// Override the default `errorLimit: 10` from `@atscript/typescript` so
// AsObject's count badges reflect every nested error on a large form.
const formValidator = computed(() =>
  getFormValidator(props.def, { errorLimit: Number.MAX_SAFE_INTEGER }),
);

// ── Form state composable ────────────────────────────────────
const { clearErrors, reset, submit, setErrors } = useFormState({
  formData: data,
  formContext: computed(() => props.formContext),
  firstValidation: computed(() => props.firstValidation),
  submitValidator: () =>
    formValidator.value({
      data: getDomainData(),
      context: (props.formContext ?? {}) as Record<string, unknown>,
    }),
});

// ── Provides ────────────────────────────────────────────────
provide(
  ROOT_DATA_KEY,
  computed(() => data.value),
);
provide(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
provide(
  TYPES_KEY,
  computed(() => props.types),
);
provide(
  COMPONENTS_KEY,
  computed(() => props.components),
);
provide(
  ERRORS_KEY,
  computed(() => props.errors),
);
provide(HIDE_ROOT_TITLE_KEY, props.hideRootTitle === true);

// Provide the collapsible-section store only if a parent hasn't already
// supplied one — a page that wants to drive Expand-all / Collapse-all UI
// calls `provideNestedSectionsStore()` *above* `<AsForm>`, and the form
// inherits that shared store instead of creating its own.
const sectionsStore = useNestedSectionsStore() ?? provideNestedSectionsStore();
if (props.clientFactory) {
  provide(CLIENT_FACTORY_KEY, props.clientFactory);
}

// External (`props.errors`) + internal validation merged into a single
// map. Drives both the descendant-count badges and the auto-open watcher.
const internalErrors = ref<Record<string, string>>({});
const allErrors = computed(() => mergeErrorMaps(props.errors, internalErrors.value));

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

// `__form` = moost-wf convention for form-level (non-field) errors.
const formError = computed(() => props.errors?.__form);

// ── Form-level resolved props ──────────────────────────────
const ctx = computed<TFnScope>(() => ({
  v: undefined,
  data: getDomainData(),
  context: (props.formContext ?? {}) as Record<string, unknown>,
  entry: undefined,
}));

const _submitText = computed(
  () =>
    resolveFormProp<string>(
      props.def.type,
      UI_FORM_FN_SUBMIT_TEXT,
      UI_FORM_SUBMIT_TEXT,
      ctx.value,
    ) ?? "Submit",
);
const _submitDisabled = computed(
  () =>
    resolveFormProp<boolean>(props.def.type, UI_FORM_FN_SUBMIT_DISABLED, undefined, ctx.value) ??
    false,
);

const emit = defineEmits<{
  (e: "submit", data: TFormData): void;
  (e: "error", errors: { path: string; message: string }[]): void;
  (e: "action", name: string, data: TFormData): void;
  (e: "unsupported-action", name: string, data: TFormData): void;
  (e: "change", type: TAsChangeType, path: string, value: unknown, formData: TFormData): void;
}>();

// ── Action handler (provided to AsField tree) ──────────────
const domainData = () => toRaw(getDomainData()) as TFormData;

function supportsAction(def: FormDef, actionId: string): boolean {
  return def.fields.some((f) => {
    const a = getFieldMeta(f.prop, UI_FORM_ACTION);
    if (a?.id === actionId) return true;
    return getFieldMeta(f.prop, WF_ACTION_WITH_DATA) === actionId;
  });
}

function handleAction(name: string) {
  if (supportsAction(props.def, name)) {
    emit("action", name, domainData());
  } else {
    emit("unsupported-action", name, domainData());
  }
}

provide(ACTION_HANDLER_KEY, handleAction);

function handleChange(type: TAsChangeType, path: string, value: unknown) {
  emit("change", type, path, value, domainData());
}
provide(CHANGE_HANDLER_KEY, handleChange);

function onSubmit() {
  const result = submit();
  if (result === true) {
    internalErrors.value = {};
    emit("submit", domainData());
  } else {
    const errs: Record<string, string> = {};
    for (const e of result) errs[e.path] = e.message;
    internalErrors.value = errs;
    emit("error", result);
  }
}
</script>

<template>
  <form class="as-form" @submit.prevent="onSubmit">
    <slot
      name="form.header"
      :clear-errors="clearErrors"
      :reset="reset"
      :set-errors="setErrors"
      :formContext="formContext"
      :disabled="_submitDisabled"
    >
    </slot>
    <slot
      name="form.before"
      :clear-errors="clearErrors"
      :reset="reset"
      :set-errors="setErrors"
    ></slot>

    <AsField :field="def.rootField" />

    <slot
      name="form.after"
      :clear-errors="clearErrors"
      :reset="reset"
      :set-errors="setErrors"
      :disabled="_submitDisabled"
      :formContext="formContext"
    ></slot>

    <slot v-if="formError" name="form.error" :message="formError">
      <div role="alert" class="as-form-error">{{ formError }}</div>
    </slot>

    <slot
      v-if="!hideSubmit"
      name="form.submit"
      :disabled="_submitDisabled"
      :text="_submitText"
      :clear-errors="clearErrors"
      :reset="reset"
      :set-errors="setErrors"
      :formContext="formContext"
    >
      <button class="as-submit-btn" :disabled="_submitDisabled">{{ _submitText }}</button>
    </slot>
    <slot
      name="form.footer"
      :disabled="_submitDisabled"
      :clear-errors="clearErrors"
      :reset="reset"
      :set-errors="setErrors"
      :formContext="formContext"
    ></slot>
  </form>
</template>
