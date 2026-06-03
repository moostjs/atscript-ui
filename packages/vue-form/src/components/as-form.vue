<script setup lang="ts" generic="TFormData = any, TFormContext = any">
import { useAsForm } from "../composables/use-as-form";
import type { TFormState } from "../composables/types";
import AsField from "./as-field.vue";
import AsIterator from "./as-iterator.vue";
import type { ClientFactory, FormDef } from "@atscript/ui";
import type { Component } from "vue";
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
  /**
   * When true, freezes the form: the body becomes `inert` (blocks pointer
   * events + keyboard focus) and a loading overlay paints over the entire
   * form area. Used by `<AsWfForm>` to lock interaction during a server
   * round-trip so the user can't edit a field whose response is racing in.
   * Visual is shared with `<AsTable>`'s query overlay via vunor
   * `inner-loading`.
   */
  loading?: boolean;
}

const props = defineProps<Props<TFormData, TFormContext>>();

const emit = defineEmits<{
  (e: "submit", data: TFormData): void;
  (e: "error", errors: { path: string; message: string }[]): void;
  (e: "action", name: string, data: TFormData): void;
  (e: "unsupported-action", name: string, data: TFormData): void;
  (e: "change", type: TAsChangeType, path: string, value: unknown, formData: TFormData): void;
}>();

const form = useAsForm<TFormData, TFormContext>({
  def: () => props.def,
  formData: () => props.formData,
  formContext: () => props.formContext,
  firstValidation: () => props.firstValidation,
  components: () => props.components,
  types: () => props.types,
  errors: () => props.errors,
  clientFactory: () => props.clientFactory,
  hideRootTitle: () => props.hideRootTitle,
  loading: () => props.loading,
  emits: {
    submit: (data) => emit("submit", data),
    error: (errors) => emit("error", errors),
    action: (name, data) => emit("action", name, data),
    unsupportedAction: (name, data) => emit("unsupported-action", name, data),
    change: (type, path, value, formData) => emit("change", type, path, value, formData),
  },
});
</script>

<template>
  <form class="as-form" :inert="loading" @submit.prevent="form.onSubmit">
    <slot
      name="form.header"
      :clear-errors="form.clearErrors"
      :reset="form.reset"
      :set-errors="form.setErrors"
      :formContext="formContext"
      :disabled="form.submitDisabled.value"
    >
    </slot>
    <slot
      name="form.before"
      :clear-errors="form.clearErrors"
      :reset="form.reset"
      :set-errors="form.setErrors"
      :formContext="formContext"
      :disabled="form.submitDisabled.value"
    ></slot>

    <AsField :field="def.rootField" />

    <slot
      name="form.after"
      :clear-errors="form.clearErrors"
      :reset="form.reset"
      :set-errors="form.setErrors"
      :disabled="form.submitDisabled.value"
      :formContext="formContext"
    ></slot>

    <slot
      v-if="form.formError.value"
      name="form.error"
      :message="form.formError.value"
      :dismiss="form.dismissFormError"
    >
      <div role="alert" class="as-form-error">
        <span class="as-form-error-message">{{ form.formError.value }}</span>
        <button type="button" class="as-form-error-dismiss" @click="form.dismissFormError">
          Dismiss
        </button>
      </div>
    </slot>

    <slot
      v-if="!hideSubmit"
      name="form.submit"
      :disabled="form.submitDisabled.value"
      :text="form.submitText.value"
      :clear-errors="form.clearErrors"
      :reset="form.reset"
      :set-errors="form.setErrors"
      :formContext="formContext"
    >
      <button class="as-submit-btn" :disabled="form.submitDisabled.value">
        {{ form.submitText.value }}
      </button>
    </slot>
    <!-- `@ui.form.pushDown` fields render in their own grid below submit. -->
    <div v-if="def.pushDownFields.length" class="as-form-grid">
      <AsIterator :def="def" :fields="def.pushDownFields" />
    </div>
    <slot
      name="form.footer"
      :disabled="form.submitDisabled.value"
      :clear-errors="form.clearErrors"
      :reset="form.reset"
      :set-errors="form.setErrors"
      :formContext="formContext"
    ></slot>
    <div v-if="loading" class="as-form-overlay">
      <slot name="form.loading">
        <span class="as-form-overlay-icon" aria-hidden="true" />
      </slot>
    </div>
  </form>
</template>
