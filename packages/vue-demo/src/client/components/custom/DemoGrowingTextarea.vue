<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

/**
 * Custom string renderer used by the custom-components demo:
 *
 *  - Section A (built-in type override) — registered in the `types` map
 *    under the `text` key, replacing the default `<AsInput>` for every
 *    string field on the form.
 *  - Section B — opt-in per field via `@ui.form.type 'bio'`.
 *
 * Lives in the consumer (vue-demo), not the library, so it uses plain
 * `demo-*` class names and renders its own minimal label/error/description
 * shell rather than depending on the library's internal `<AsFieldShell>`.
 * Wires the full `inputId` / `ariaDescribedBy` / `error` contract so
 * label-for, error-by, and description-by associations keep working.
 */
const props = defineProps<TAsComponentProps<string | null | undefined>>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function resize(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  // Clamp at ~300px after which native overflow scrolling takes over.
  const next = Math.min(el.scrollHeight, 300);
  el.style.height = `${next}px`;
}

function onInput(e: Event): void {
  const el = e.target as HTMLTextAreaElement;
  props.model.value = el.value;
  resize();
}

// External model changes (form reset, programmatic write) must also
// resize. Wait a tick so the new content is in the DOM before measuring.
watch(
  () => props.model.value,
  () => {
    void nextTick(resize);
  },
);
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden">
    <label v-if="label" :for="inputId" class="demo-field-label">{{ label }}</label>
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <textarea
      :id="inputId"
      ref="textareaRef"
      class="demo-growing-textarea"
      :class="{ error: !!error }"
      :value="model.value ?? ''"
      :placeholder="placeholder"
      :name="name"
      :disabled="disabled"
      :readonly="readonly"
      :aria-required="required || undefined"
      :aria-invalid="!!error || undefined"
      :aria-describedby="ariaDescribedBy"
      :aria-label="!label ? name : undefined"
      rows="2"
      @input="onInput"
      @blur="onBlur"
    />
    <div
      v-if="error || hint"
      :id="errorId"
      class="demo-field-error"
      :role="error ? 'alert' : undefined"
    >
      {{ error || hint }}
    </div>
  </div>
</template>

<style scoped>
.demo-growing-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 300px;
  padding: 8px 10px;
  font: inherit;
  line-height: 1.4;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
  opacity: 0.95;
}
.demo-growing-textarea:focus {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
.demo-growing-textarea.error {
  border-color: #ef4444;
}
.demo-growing-textarea:disabled,
.demo-growing-textarea[readonly] {
  opacity: 0.5;
}
</style>
