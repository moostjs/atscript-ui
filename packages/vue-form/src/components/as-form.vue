<script setup lang="ts" generic="TFormData = any, TFormContext = any">
import { useFormState } from "../composables/use-form-state";
import type { TFormState } from "../composables/types";
import AsField from "./as-field.vue";
import type { FormDef } from "@atscript/ui";
import { getFormValidator, resolveFormProp, getFieldMeta, WF_ACTION_WITH_DATA } from "@atscript/ui";
import type { ValueHelpClientFactory } from "../composables/use-value-help";
import type { TFnScope } from "@atscript/ui-fns";
import { computed, provide, ref, toRaw, type Component } from "vue";
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
  /** Client factory for FK ref fields (value-help). Creates Client instances from URL paths. */
  valueHelpClientFactory?: ValueHelpClientFactory;
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
const formValidator = computed(() => getFormValidator(props.def));

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
  "__as_root_data",
  computed<TFormData>(() => data.value),
);
provide(
  "__as_path_prefix",
  computed(() => ""),
);
provide(
  "__as_types",
  computed(() => props.types),
);
provide(
  "__as_components",
  computed(() => props.components),
);
provide(
  "__as_errors",
  computed(() => props.errors),
);
if (props.valueHelpClientFactory) {
  provide("__as_vh_client_factory", props.valueHelpClientFactory);
}

// ── Form-level resolved props ──────────────────────────────
const ctx = computed<TFnScope>(() => ({
  v: undefined,
  data: getDomainData(),
  context: (props.formContext ?? {}) as Record<string, unknown>,
  entry: undefined,
}));

const _submitText = computed(
  () =>
    resolveFormProp<string>(props.def.type, "ui.fn.submit.text", "ui.submit.text", ctx.value) ??
    "Submit",
);
const _submitDisabled = computed(
  () =>
    resolveFormProp<boolean>(
      props.def.type,
      "ui.fn.submit.disabled",
      "ui.submit.disabled",
      ctx.value,
    ) ?? false,
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
    const a = getFieldMeta(f.prop, "ui.form.action");
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

provide("__as_action_handler", handleAction);

function handleChange(type: TAsChangeType, path: string, value: unknown) {
  emit("change", type, path, value, domainData());
}
provide("__as_change_handler", handleChange);

function onSubmit() {
  const result = submit();
  if (result === true) {
    emit("submit", domainData());
  } else {
    emit("error", result);
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit">
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

    <slot
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
